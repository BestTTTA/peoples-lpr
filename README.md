# Peoples LPR — powered by Solutionmania

Developed by Thetigerteam Foundation Technology.

A site for returning lost Thai license plates (e.g. after floods). Finders photograph plates they picked up and pin where they are. Owners search for their plate and see where to collect it.

## Setup

```bash
cp .env.example .env.local   # then fill in the keys (see Environment below)
npm install
npm run tunnel               # separate terminal: Postgres on spark over Tailscale
npm run dev
```

The map is [OpenFreeMap](https://openfreemap.org/) ("Fiord" style) rendered with MapLibre GL, so no map API key is needed.

## How it works

- **`/report`**: the finder uploads photos (several plates per photo is fine), chooses **AI auto-crop** (boxes come from the plate detector via `/api/detect`, and can be fixed by hand) or **manual** boxes, and the crops are sent to the OCR API (in batches of 8, the API's limit). The OCR model reads one plate per image, so the boxes are required for multi-plate photos. The finder corrects prefix/number/province (low-confidence fields are highlighted), pins the location via GPS or by tapping the map, and confirms.
- **`/`**: a full-screen map with a floating panel (layout after the Jetboost CMS Map dark demo). Pins are coloured by how recently the plates were found (green ≤ 3 days, blue ≤ 2 weeks, red older), and each report's place name comes from OpenStreetMap Nominatim at submit time. It is a clustered map of found plates. Pins show only prefix and province. Searching needs prefix + number + province. It returns the photo, pickup note and contact, plus near matches (one character off, or a different province).

## MapLibre worker

MapLibre v6 loads its web worker from a separate file, and the bundler can't resolve it. `scripts/copy-maplibre-worker.mjs` copies it into `public/maplibre/`; it runs automatically on `npm install`, `npm run dev` and `npm run build`.

## Storage

Reports live in **Postgres** and photos/plate crops in **MinIO**, both on the spark server
alongside FaceFinder, but isolated from it:

| | Where | Access |
|---|---|---|
| Postgres | database `peoples_lpr` in `facefinder-postgres` (spark `127.0.0.1:5555`) | role `peoples_lpr`, owns only its own database |
| MinIO | bucket `peoples-lpr` in `facefinder-minio`, public at `https://minio-facefinder.roljetson.com` | user `peoples-lpr`, policy limited to that bucket |

Tables (`reports`, `plates`) are created automatically on first request (`lib/store.ts`).
The bucket is private; images are served through `/api/files/[name]`.

Postgres is bound to loopback on spark and spark has no public inbound address, so from a
laptop reach it over Tailscale with `npm run tunnel` (forwards `localhost:15555`, reconnects on drops).

`scripts/import-file-store.mjs` imports the old flat-file store (`data/`) and is safe to re-run.

### Environment

| Variable | Purpose |
|---|---|
| `OCR_API_KEY` | Key for https://ocrapi.roljetson.com (server-side only) |
| `OCR_API_URL` | OCR API base URL (optional) |
| `OCR_MAX_BATCH` | Images per upstream OCR request (optional, default 8 — the API's limit) |
| `CROP_API_URL` | Plate detector for auto-crop (default `http://plate-crop:8000`, the compose service) |
| `CROP_CONF` | Detector confidence threshold (optional, default 0.25) |
| `DATABASE_URL` | Postgres connection string |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | MinIO |

## Deploy

Production runs on spark, like FaceFinder's API: a Docker container (`peoples-lpr`) on
FaceFinder's network (`repo_default`), published on `127.0.0.1:3300`, and exposed through
the existing Cloudflare tunnel (`cloudflare-tunnel`, host network) as a public hostname
pointing at `http://localhost:3300`.

- Checkout on the server: `~/Project/peoples-lpr`, with a `.env` (see `.env.example`; set `PG_PASSWORD`).
- `./docker/deploy.sh` builds the image on the server (arm64), swaps the container, checks
  `/api/reports`, and rolls back on failure.
- `.github/workflows/deploy.yml` runs lint + build, then joins the tailnet and runs
  `deploy.sh` over SSH. Secrets: `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` (Tailscale OAuth
  client, Auth Keys write, `tag:ci`), `DEPLOY_SSH_KEY_B64` (private key as one base64 line),
  `DEPLOY_SERVER`, `DEPLOY_USER`.
- The deploy key is restricted on the server to `docker/ci-deploy.sh` (copied to
  `~/bin/peoples-lpr-deploy`), so it can only run `deploy <sha>`.

## Plate detector (auto-crop)

`crop-service/` is a small FastAPI app around the YOLOv8 plate detector
[Koushim/yolov8-license-plate-detection](https://huggingface.co/Koushim/yolov8-license-plate-detection)
(MIT). `POST /crops` takes an image and returns plate boxes in pixels; `/api/detect`
filters them and the browser crops. In production it is the `plate-crop` compose
service, reachable only from the web container; the image downloads the weights
from a pinned revision and checks their sha256.

Local dev (needs Python with `ultralytics`, or run the Docker image):

```bash
MODEL_PATH=path/to/best.pt python -m uvicorn --app-dir crop-service app:app --port 8765
# and in .env.local: CROP_API_URL=http://127.0.0.1:8765
```

## Admin page (`/admin`)

Sign in with `ADMIN_PASSWORD` (server `.env`, at least 8 characters). The page
is not linked from the site and is excluded from robots.

- **Detector settings**: confidence, NMS IOU, input size, plate-shape filter.
  Saved in Postgres (`settings` table) and used by `/api/detect` within ~10 s.
  Env (`CROP_CONF`, `CROP_IOU`, `CROP_IMGSZ`) only supplies the defaults.
- **Test**: upload a photo and see every model's boxes with the unsaved settings.
- **Models**: upload YOLO `.pt` detect models (≤ 95 MB, validated by loading
  them), choose the primary model, or turn on **compare** mode: each photo
  goes to two models and the answer with more plate-shaped boxes is used (ties:
  higher mean confidence). Uploads live in the crop service's `crop-data`
  volume; the web app reaches its model API with `CROP_ADMIN_TOKEN`.

A `.pt` file runs code when loaded, so only upload models from trusted sources.
