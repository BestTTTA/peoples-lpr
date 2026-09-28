# syntax=docker/dockerfile:1.7
# Plate detector for auto-crop; built on the spark server (arm64) by docker/deploy.sh.
FROM python:3.12-slim

# OpenCV (pulled in by ultralytics) needs these at import time.
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# CPU build of torch: the model is small (YOLOv8n-sized, 6 MB) and 640px
# inference is quick on the host's cores; no CUDA image needed.
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Koushim/yolov8-license-plate-detection (MIT), pinned by revision and checksum.
ADD --checksum=sha256:2d95861825bb4184404344c9cf809f40fd31dba785fe54e8ba5b9a3583789822 \
    https://huggingface.co/Koushim/yolov8-license-plate-detection/resolve/9aaa5cd490abe0c165882ba87f4f62658ab54d01/best.pt \
    /models/best.pt

COPY app.py .
ENV MODEL_PATH=/models/best.pt DATA_DIR=/data YOLO_CONFIG_DIR=/tmp/Ultralytics PYTHONUNBUFFERED=1
# /data is a volume (uploaded models); created here so it is owned by app.
RUN useradd --create-home app && chmod 644 /models/best.pt && mkdir -p /data/models && chown -R app /data
USER app
EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
