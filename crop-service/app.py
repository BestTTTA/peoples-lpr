"""Plate detector for auto-crop: YOLOv8 (Koushim/yolov8-license-plate-detection).

Same contract as the crop service it replaces, so the web app only needs
CROP_API_URL pointed here:

    POST /crops   multipart: file (image), conf (optional float)
      -> {"count": n, "crops": [{"box": [x1, y1, x2, y2], "conf": 0.87,
                                  "class_id": 0, "class_name": "license_plate"}]}
    GET  /health  -> {"status": "ok", ...}

Boxes are in pixels of the image as sent, highest confidence first. Unlike the
old service it returns no base64 crops: the web app crops on its own.
"""

import os
from io import BytesIO

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from ultralytics import YOLO

MODEL_PATH = os.environ.get("MODEL_PATH", "/models/best.pt")
DEFAULT_CONF = float(os.environ.get("CONF", "0.25"))
# Lower than YOLO's default 0.7: plates laid side by side otherwise keep
# overlapping boxes that each cover parts of two plates.
IOU = float(os.environ.get("IOU", "0.45"))
IMGSZ = int(os.environ.get("IMGSZ", "640"))
MAX_BYTES = 10 * 1024 * 1024

model = YOLO(MODEL_PATH, task="detect")
app = FastAPI(title="Plate crop service")


@app.get("/health")
def health():
    return {"status": "ok", "model": os.path.basename(MODEL_PATH), "classes": model.names}


@app.post("/crops")
async def crops(file: UploadFile = File(...), conf: float = Form(DEFAULT_CONF)):
    data = await file.read()
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(413, "image missing or larger than 10MB")
    try:
        # Honour EXIF rotation so boxes match the image the browser shows.
        img = ImageOps.exif_transpose(Image.open(BytesIO(data))).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "not an image")

    # Ultralytics takes numpy images as BGR.
    frame = np.asarray(img)[:, :, ::-1]
    result = model.predict(frame, conf=max(0.01, min(conf, 1.0)), iou=IOU, imgsz=IMGSZ, verbose=False)[0]

    out = []
    for (x1, y1, x2, y2), score, cls in zip(
        result.boxes.xyxy.tolist(), result.boxes.conf.tolist(), result.boxes.cls.tolist()
    ):
        out.append(
            {
                "box": [round(x1), round(y1), round(x2), round(y2)],
                "conf": round(score, 4),
                "class_id": int(cls),
                "class_name": model.names[int(cls)],
            }
        )
    out.sort(key=lambda c: c["conf"], reverse=True)
    return {"count": len(out), "crops": out}
