# Peoples LPR — powered by Solutionmania

Developed by Thetigerteam Foundation Technology.

A site for returning lost Thai license plates (e.g. after floods). Finders photograph plates they picked up and pin where they are. Owners search for their plate and see where to collect it.

## Setup

```bash
cp .env.example .env.local   # then fill in the keys
npm install
npm run dev
```

| Variable | Purpose |
| --- | --- |
| `OCR_API_KEY` | Key for https://ocrapi.roljetson.com (server-side only, never sent to the browser) |
| `OCR_API_URL` | OCR API base URL |

The map is [OpenFreeMap](https://openfreemap.org/) ("Fiord" style) rendered with MapLibre GL, so no map API key is needed.

## How it works

- **`/report`**: the finder uploads photos (several plates per photo is fine), draws a box around each plate, and the crops are sent to the OCR API as one batch. The OCR model reads one plate per image, so the boxes are required for multi-plate photos. The finder corrects prefix/number/province (low-confidence fields are highlighted), pins the location via GPS or by tapping the map, and confirms.
- **`/`**: a full-screen map with a floating panel (layout after the Jetboost CMS Map dark demo). Pins are coloured by how recently the plates were found (green ≤ 3 days, blue ≤ 2 weeks, red older), and each report's place name comes from OpenStreetMap Nominatim at submit time. It is a clustered map of found plates. Pins show only prefix and province. Searching needs prefix + number + province. It returns the photo, pickup note and contact, plus near matches (one character off, or a different province).

## MapLibre worker

MapLibre v6 loads its web worker from a separate file, and the bundler can't resolve it. `scripts/copy-maplibre-worker.mjs` copies it into `public/maplibre/`; it runs automatically on `npm install`, `npm run dev` and `npm run build`.

## Storage

Reports are kept in `data/reports.json`, and photos in `data/files/`. This is fine for a single server; move to a database and object storage before running more than one instance.
