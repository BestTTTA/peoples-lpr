"""Compare detectors on the held-out photos, the way the app runs them:
whole photo plus 800 px overlapping tiles, merged, then the plate-shape filter.

Labels are the plates finders boxed, which is not always every plate in the
photo, so precision is a lower bound (for every model alike); recall is the
figure that says how many real plates each model finds.

    python3 evaluate.py ds name1=model1.pt name2=model2.pt
"""

import json
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import torch
import torchvision
from ultralytics import YOLO

TILE, OVERLAP, IOU_NMS, IMGSZ = 800, 0.3, 0.45, 640
ASPECT = (1.1, 3.6)


def tiles(w, h):
    step = int(TILE * (1 - OVERLAP))

    def starts(n):
        s = list(range(0, max(1, n - TILE) + 1, step))
        if s[-1] + TILE < n:
            s.append(n - TILE)
        return s

    return [(x, y, min(w, x + TILE), min(h, y + TILE)) for y in starts(h) for x in starts(w)]


def shaped(b):
    return ASPECT[0] <= (b[2] - b[0]) / max(1.0, b[3] - b[1]) <= ASPECT[1]


def detect(model, img, conf):
    h, w = img.shape[:2]
    windows = [(0, 0, w, h)] + (tiles(w, h) if max(w, h) > TILE * 1.15 else [])
    res = model.predict([img[y1:y2, x1:x2] for x1, y1, x2, y2 in windows], conf=conf, iou=IOU_NMS, imgsz=IMGSZ, verbose=False)
    boxes = []
    for (wx1, wy1, wx2, wy2), r in zip(windows, res):
        whole = (wx1, wy1, wx2, wy2) == (0, 0, w, h)
        for (x1, y1, x2, y2), s in zip(r.boxes.xyxy.tolist(), r.boxes.conf.tolist()):
            if not whole and ((x1 <= 2 and wx1 > 0) or (y1 <= 2 and wy1 > 0) or (x2 >= wx2 - wx1 - 2 and wx2 < w) or (y2 >= wy2 - wy1 - 2 and wy2 < h)):
                continue
            boxes.append((x1 + wx1, y1 + wy1, x2 + wx1, y2 + wy1, s))
    if len(windows) > 1 and boxes:
        t = torch.tensor([b[:4] for b in boxes], dtype=torch.float32)
        keep = torchvision.ops.nms(t, torch.tensor([b[4] for b in boxes]), 0.5).tolist()
        kept = [boxes[i] for i in keep]
        area = lambda b: (b[2] - b[0]) * (b[3] - b[1])  # noqa: E731
        boxes = [
            a for a in kept
            if not any(
                b is not a and area(b) > area(a) and shaped(b)
                and max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1])) > 0.7 * area(a)
                for b in kept
            )
        ]
    return [b for b in boxes if shaped(b)]


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - ix
    return ix / u if u else 0.0


def load_val(ds: Path):
    items = []
    for p in sorted((ds / "images" / "val").glob("*.jpg")):
        img = cv2.imread(str(p))
        h, w = img.shape[:2]
        gt = []
        for line in (ds / "labels" / "val" / f"{p.stem}.txt").read_text().split("\n"):
            if line.strip():
                _, cx, cy, bw, bh = map(float, line.split())
                gt.append(((cx - bw / 2) * w, (cy - bh / 2) * h, (cx + bw / 2) * w, (cy + bh / 2) * h))
        items.append((p.name, img, gt))
    return items


def score(model, items, conf):
    tp = fp = fn = 0
    t0 = time.time()
    for _, img, gt in items:
        preds = sorted(detect(model, img, conf), key=lambda b: -b[4])
        used = set()
        for p in preds:
            best, bi = 0.0, -1
            for i, g in enumerate(gt):
                if i not in used and (v := iou(p, g)) > best:
                    best, bi = v, i
            if best >= 0.5:
                used.add(bi)
                tp += 1
            else:
                fp += 1
        fn += len(gt) - len(used)
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    return {"conf": conf, "tp": tp, "fp": fp, "fn": fn, "precision": round(p, 3), "recall": round(r, 3), "f1": round(f1, 3),
            "ms_per_photo": round((time.time() - t0) / len(items) * 1000)}


def main():
    ds = Path(sys.argv[1])
    models = dict(a.split("=", 1) for a in sys.argv[2:])
    items = load_val(ds)
    print(f"{len(items)} held-out photos, {sum(len(g) for _, _, g in items)} labelled plates")
    report = {}
    for name, path in models.items():
        m = YOLO(path, task="detect")
        rows = [score(m, items, c) for c in (0.1, 0.25, 0.4)]
        v = m.val(data=str(ds / "data.yaml"), imgsz=IMGSZ, split="val", verbose=False, plots=False)
        report[name] = {"pipeline": rows, "mAP50": round(float(v.box.map50), 3), "mAP50_95": round(float(v.box.map), 3)}
        print(name, json.dumps(report[name], ensure_ascii=False))
    json.dump(report, open(ds / "eval.json", "w"), indent=2)


if __name__ == "__main__":
    main()
