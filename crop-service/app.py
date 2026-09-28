"""Plate detector for auto-crop (YOLO, ultralytics).

    POST /crops   multipart: file (image), model, conf, iou, imgsz, tile, overlap,
                  aspect_min, aspect_max (all but file optional)
      -> {"count": n, "model": id, "crops": [{"box": [x1, y1, x2, y2], "conf": 0.87,
                                              "class_id": 0, "class_name": "license_plate"}]}
    GET  /health

Which model(s) to use is the web app's setting (it may ask two models and keep
the better answer); this service just runs the one named, "builtin" by default.

Model management, for the web app's admin page (header X-Admin-Token must equal
ADMIN_TOKEN; without ADMIN_TOKEN these are disabled):

    GET    /models               list
    POST   /models               multipart: file (.pt), name -> validated and stored
    POST   /models/{id}/load     load into memory now (so first use is quick)
    DELETE /models/{id}

The built-in model (Koushim/yolov8-license-plate-detection, baked into the
image) is always available as id "builtin". Uploads live under DATA_DIR, a
volume, so they survive rebuilds.

Loading a .pt file runs code from it (PyTorch pickles), so uploads must only
come from trusted admins; that is what the token guards.
"""

import hmac
import json
import os
import re
import shutil
import tempfile
import threading
import time
from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path

import numpy as np
import torch
import torchvision
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from ultralytics import YOLO

BUILTIN_PATH = Path(os.environ.get("MODEL_PATH", "/models/best.pt"))
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
MODELS_DIR = DATA_DIR / "models"
# Uploads land here first (named .pt: ultralytics picks the format by extension).
UPLOAD_DIR = DATA_DIR / "uploads"
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")

DEFAULT_CONF = float(os.environ.get("CONF", "0.25"))
# Lower than YOLO's default 0.7: plates laid side by side otherwise keep
# overlapping boxes that each cover parts of two plates.
DEFAULT_IOU = float(os.environ.get("IOU", "0.45"))
DEFAULT_IMGSZ = int(os.environ.get("IMGSZ", "640"))
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_MODEL_BYTES = 200 * 1024 * 1024
# Compare mode keeps two in use; one spare avoids reloading while switching.
MAX_LOADED = 3

MODELS_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
_lock = threading.Lock()
_loaded: dict[str, YOLO] = {}


def _path(model_id: str) -> Path:
    if model_id == "builtin":
        return BUILTIN_PATH
    if not re.fullmatch(r"[a-z0-9-]{1,64}", model_id):
        raise HTTPException(404, "no such model")
    p = MODELS_DIR / f"{model_id}.pt"
    if not p.exists():
        raise HTTPException(404, "no such model")
    return p


def _meta(model_id: str) -> dict:
    if model_id == "builtin":
        return {"name": "Koushim YOLOv8 license plate (ติดมากับระบบ)", "uploadedAt": None}
    f = MODELS_DIR / f"{model_id}.json"
    return json.loads(f.read_text("utf-8")) if f.exists() else {"name": model_id, "uploadedAt": None}


def _model(model_id: str) -> YOLO:
    with _lock:
        if model_id in _loaded:
            _loaded[model_id] = _loaded.pop(model_id)  # most recently used last
        else:
            while len(_loaded) >= MAX_LOADED:
                del _loaded[next(iter(_loaded))]
            _loaded[model_id] = YOLO(str(_path(model_id)), task="detect")
        return _loaded[model_id]


def _require_admin(token: str | None):
    if not ADMIN_TOKEN:
        raise HTTPException(403, "model management is disabled (no ADMIN_TOKEN)")
    if not token or not hmac.compare_digest(token.encode(), ADMIN_TOKEN.encode()):
        raise HTTPException(401, "bad admin token")


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    _model("builtin")  # load before taking traffic
    yield


app = FastAPI(title="Plate crop service", lifespan=_lifespan)


def _tiles(w: int, h: int, size: int, overlap: float) -> list[tuple[int, int, int, int]]:
    """Overlapping size x size windows covering the image, the last row/column flush with the edge."""
    step = max(1, int(size * (1 - overlap)))

    def starts(n: int) -> list[int]:
        s = list(range(0, max(1, n - size) + 1, step))
        if s[-1] + size < n:
            s.append(n - size)
        return s

    return [(x, y, min(w, x + size), min(h, y + size)) for y in starts(h) for x in starts(w)]


def _merge(boxes: list[tuple], iou: float, shaped) -> list[tuple]:
    """NMS across tiles, then drop boxes mostly inside a bigger plate-shaped one (plates cut by a tile)."""
    if not boxes:
        return []
    t = torch.tensor([b[:4] for b in boxes], dtype=torch.float32)
    keep = torchvision.ops.nms(t, torch.tensor([b[4] for b in boxes]), iou).tolist()
    kept = [boxes[i] for i in keep]
    area = lambda b: (b[2] - b[0]) * (b[3] - b[1])  # noqa: E731
    out = []
    for a in kept:
        inside = False
        for b in kept:
            if b is a or area(b) <= area(a) or not shaped(b):
                continue
            ix = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
            if ix > 0.7 * area(a):
                inside = True
                break
        if not inside:
            out.append(a)
    return out


@app.get("/health")
def health():
    return {"status": "ok", "loaded": list(_loaded)}


@app.post("/crops")
async def crops(
    file: UploadFile = File(...),
    model: str = Form("builtin"),
    conf: float = Form(DEFAULT_CONF),
    iou: float = Form(DEFAULT_IOU),
    imgsz: int = Form(DEFAULT_IMGSZ),
    tile: int = Form(0),
    overlap: float = Form(0.3),
    aspect_min: float = Form(1.1),
    aspect_max: float = Form(3.6),
):
    data = await file.read()
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "image missing or larger than 10MB")
    try:
        # Honour EXIF rotation so boxes match the image the browser shows.
        img = ImageOps.exif_transpose(Image.open(BytesIO(data))).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "not an image")

    model_id = model
    yolo = _model(model_id)
    frame = np.asarray(img)[:, :, ::-1]  # ultralytics takes numpy images as BGR
    h, w = frame.shape[:2]
    conf = min(max(conf, 0.01), 0.99)
    iou = min(max(iou, 0.05), 0.95)
    imgsz = min(max(imgsz // 32 * 32, 320), 1280)
    overlap = min(max(overlap, 0.05), 0.6)

    # Whole image first (big plates), then, for images larger than one tile,
    # overlapping tiles: the model sees each at full resolution instead of the
    # whole photo squeezed to imgsz, which is what loses small plates (many
    # plates on a table, portrait photos).
    windows = [(0, 0, w, h)]
    if tile >= 320 and max(w, h) > tile * 1.15:
        windows += _tiles(w, h, tile, overlap)
    crops = [frame[y1:y2, x1:x2] for x1, y1, x2, y2 in windows]
    results = yolo.predict(crops, conf=conf, iou=iou, imgsz=imgsz, verbose=False)

    boxes = []
    for (wx1, wy1, wx2, wy2), r in zip(windows, results):
        whole = (wx1, wy1, wx2, wy2) == (0, 0, w, h)
        for (x1, y1, x2, y2), score, cls in zip(r.boxes.xyxy.tolist(), r.boxes.conf.tolist(), r.boxes.cls.tolist()):
            # A box touching an inner tile edge is a cut plate; a neighbouring tile has it whole.
            if not whole and (
                (x1 <= 2 and wx1 > 0) or (y1 <= 2 and wy1 > 0) or (x2 >= wx2 - wx1 - 2 and wx2 < w) or (y2 >= wy2 - wy1 - 2 and wy2 < h)
            ):
                continue
            boxes.append((x1 + wx1, y1 + wy1, x2 + wx1, y2 + wy1, score, int(cls)))

    def shaped(b) -> bool:
        return aspect_min <= (b[2] - b[0]) / max(1.0, b[3] - b[1]) <= aspect_max

    if len(windows) > 1:
        boxes = _merge(boxes, 0.5, shaped)

    out = [
        {
            "box": [round(x1), round(y1), round(x2), round(y2)],
            "conf": round(score, 4),
            "class_id": cls,
            "class_name": yolo.names[cls],
        }
        for x1, y1, x2, y2, score, cls in boxes
    ]
    out.sort(key=lambda c: c["conf"], reverse=True)
    return {"count": len(out), "model": model_id, "tiles": len(windows) - 1, "crops": out}


@app.get("/models")
def list_models(x_admin_token: str | None = Header(None)):
    _require_admin(x_admin_token)
    ids = ["builtin"] + sorted(p.stem for p in MODELS_DIR.glob("*.pt"))
    out = []
    for model_id in ids:
        p = _path(model_id)
        meta = _meta(model_id)
        out.append(
            {
                "id": model_id,
                "name": meta.get("name", model_id),
                "uploadedAt": meta.get("uploadedAt"),
                "classes": meta.get("classes"),
                "size": p.stat().st_size,
                "loaded": model_id in _loaded,
                "builtin": model_id == "builtin",
            }
        )
    return {"models": out}


@app.post("/models")
async def upload_model(
    file: UploadFile = File(...),
    name: str = Form(""),
    x_admin_token: str | None = Header(None),
):
    _require_admin(x_admin_token)
    if not (file.filename or "").lower().endswith(".pt"):
        raise HTTPException(400, "ต้องเป็นไฟล์ .pt ของ YOLO (ultralytics)")

    with tempfile.NamedTemporaryFile(dir=UPLOAD_DIR, suffix=".pt", delete=False) as tmp:
        size = 0
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_MODEL_BYTES:
                tmp.close()
                os.unlink(tmp.name)
                raise HTTPException(413, "ไฟล์โมเดลใหญ่เกิน 200MB")
            tmp.write(chunk)
    try:
        # Must load as a detection model and actually run.
        probe = YOLO(tmp.name, task="detect")
        if probe.task != "detect":
            raise ValueError(f"task is {probe.task}, need detect")
        probe.predict(np.zeros((320, 320, 3), dtype=np.uint8), verbose=False)
        classes = {int(k): v for k, v in probe.names.items()}
    except Exception as err:  # noqa: BLE001 - any failure means an unusable file
        os.unlink(tmp.name)
        # First line only, and without our paths.
        reason = str(err).splitlines()[0].replace(tmp.name, "file")[:200]
        raise HTTPException(400, f"เปิดโมเดลไม่ได้: {reason}") from err

    model_id = time.strftime("%Y%m%d-%H%M%S") + "-" + os.urandom(3).hex()
    shutil.move(tmp.name, MODELS_DIR / f"{model_id}.pt")
    meta = {
        "name": name.strip()[:80] or (file.filename or model_id),
        "uploadedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "classes": classes,
    }
    (MODELS_DIR / f"{model_id}.json").write_text(json.dumps(meta, ensure_ascii=False), "utf-8")
    return {"id": model_id, **meta, "size": size}


@app.post("/models/{model_id}/load")
def load(model_id: str, x_admin_token: str | None = Header(None)):
    _require_admin(x_admin_token)
    model = _model(model_id)
    return {"id": model_id, "classes": model.names}


@app.delete("/models/{model_id}")
def delete(model_id: str, x_admin_token: str | None = Header(None)):
    _require_admin(x_admin_token)
    if model_id == "builtin":
        raise HTTPException(400, "ลบโมเดลที่ติดมากับระบบไม่ได้")
    # The web app refuses to delete a model its settings still use.
    p = _path(model_id)
    p.unlink()
    (MODELS_DIR / f"{model_id}.json").unlink(missing_ok=True)
    _loaded.pop(model_id, None)
    return {"deleted": model_id}
