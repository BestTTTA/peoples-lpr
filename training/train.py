"""Fine-tune the plate detector on the dataset from build_dataset.py.

    python3 train.py ds/data.yaml base.pt runs/
"""

import sys

from ultralytics import YOLO

data, base, project = sys.argv[1], sys.argv[2], sys.argv[3]
YOLO(base).train(
    data=data,
    imgsz=640,  # what crop-service runs at (on tiles of 800 px)
    epochs=100,
    patience=25,
    batch=16,
    device=0,
    seed=0,
    workers=4,
    degrees=15,  # plates are often laid down or held at an angle
    fliplr=0.0,  # mirrored plates never occur
    project=project,
    name="plates",
    exist_ok=True,
)
