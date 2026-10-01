"""Build a YOLO plate-detection dataset from what finders reported.

Since 1 Oct 2026 the app stores each plate's box in its photo (plates.box), plus
plates boxed but left out as unreadable (reports.extra_boxes, kind "skipped"),
which count as plates here too. Older reports only have the crop: crops are cut
straight out of the stored photo (padded 2% per side, scaled down only if
wider/taller than 800 px), so template matching finds the box again almost
exactly. Either way the boxes were drawn or accepted by a person.

The same photo is often sent in several reports, each with some of its plates
boxed; copies are grouped (same size + perceptual hash) and their boxes merged.
Groups are split train/val so no photo leaks from one to the other. Training
images also get the 800 px overlapping tiles crop-service searches at run time.

    python3 build_dataset.py reports.json http://127.0.0.1:3300 out/ [previous/split.json]

With a previous split, photos keep their side (train/val) so the old model is
never scored on photos it trained on; only new photos are split afresh.
"""

import hashlib
import json
import random
import sys
import urllib.request
from pathlib import Path

import cv2
import numpy as np

PAD = 0.02
MATCH_MIN = 0.85
VAL_SHARE = 0.2
TILE, OVERLAP = 800, 0.3


def fetch(base: str, name: str, cache: Path) -> np.ndarray | None:
    p = cache / name
    if not p.exists():
        try:
            p.write_bytes(urllib.request.urlopen(f"{base}/api/files/{name}", timeout=30).read())
        except Exception:
            return None
    return cv2.imread(str(p))


def locate(photo: np.ndarray, crop: np.ndarray) -> tuple[list[float], float] | None:
    """Box (x1, y1, x2, y2) of the plate the crop was cut for, and the match score."""
    H, W = photo.shape[:2]
    ch, cw = crop.shape[:2]
    # Cropped at 1:1 unless the padded box was over 800 px; then try upscales.
    scales = [1.0] if max(cw, ch) < 799 else list(np.arange(1.0, 3.01, 0.02))
    best = None
    for k in scales:
        tw, th = round(cw * k), round(ch * k)
        if tw > W or th > H:
            break
        t = crop if k == 1.0 else cv2.resize(crop, (tw, th), interpolation=cv2.INTER_CUBIC)
        if (tw, th) == (W, H):
            score = float(cv2.matchTemplate(photo, t, cv2.TM_CCOEFF_NORMED)[0, 0])
            loc = (0, 0)
        else:
            res = cv2.matchTemplate(photo, t, cv2.TM_CCOEFF_NORMED)
            _, score, _, loc = cv2.minMaxLoc(res)
        if best is None or score > best[0]:
            best = (score, loc, tw, th)
    if not best or best[0] < MATCH_MIN:
        return None
    score, (mx, my), mw, mh = best
    # Undo the padding, except on sides where the photo edge clipped it.
    px, py = PAD * mw / (1 + 2 * PAD), PAD * mh / (1 + 2 * PAD)
    x1 = mx + (px if mx > 1 else 0)
    y1 = my + (py if my > 1 else 0)
    x2 = mx + mw - (px if mx + mw < W - 1 else 0)
    y2 = my + mh - (py if my + mh < H - 1 else 0)
    return [x1, y1, x2, y2], score


def stored_box(b: dict, W: int, H: int) -> list[float] | None:
    """A box the app stored (fractions of the photo) in pixels; tilted ones as their upright bounds."""
    try:
        x1, y1 = b["x"] * W, b["y"] * H
        x2, y2 = (b["x"] + b["w"]) * W, (b["y"] + b["h"]) * H
    except (KeyError, TypeError):
        return None
    x1, y1, x2, y2 = max(0, x1), max(0, y1), min(W, x2), min(H, y2)
    return [x1, y1, x2, y2] if x2 - x1 > 2 and y2 - y1 > 2 else None


def phash(img: np.ndarray) -> str:
    g = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (16, 16), interpolation=cv2.INTER_AREA)
    return hashlib.md5((g > g.mean()).tobytes()).hexdigest()


def iou(a, b) -> float:
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(0, min(a[3], b[3]) - max(a[1], b[1]))
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - ix
    return ix / u if u else 0.0


def yolo_lines(boxes, W, H) -> list[str]:
    return [
        f"0 {(x1 + x2) / 2 / W:.6f} {(y1 + y2) / 2 / H:.6f} {(x2 - x1) / W:.6f} {(y2 - y1) / H:.6f}"
        for x1, y1, x2, y2 in boxes
    ]


def tiles(W, H):
    step = int(TILE * (1 - OVERLAP))

    def starts(n):
        s = list(range(0, max(1, n - TILE) + 1, step))
        if s[-1] + TILE < n:
            s.append(n - TILE)
        return s

    return [(x, y, min(W, x + TILE), min(H, y + TILE)) for y in starts(H) for x in starts(W)]


def main():
    reports_path, base, out = sys.argv[1], sys.argv[2].rstrip("/"), Path(sys.argv[3])
    prev_split = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else {}
    cache = out / "cache"
    cache.mkdir(parents=True, exist_ok=True)
    reports = json.load(open(reports_path, encoding="utf-8"))

    groups: dict[str, dict] = {}
    stats = {"plates": 0, "stored_box": 0, "matched": 0, "skipped_boxes": 0, "photo_missing": 0, "no_match": 0}
    for r in reports:
        photos = [fetch(base, n, cache) for n in r["photos"]]
        for i, name in enumerate(r["photos"]):
            img = photos[i]
            if img is None:
                stats["photo_missing"] += 1
                continue
            H, W = img.shape[:2]
            key = f"{W}x{H}-{phash(img)}"
            g = groups.setdefault(key, {"name": name, "img": img, "boxes": []})
            for p in r["plates"] or []:
                if p["photo"] != i:
                    continue
                stats["plates"] += 1
                box = stored_box(p["box"], W, H) if p.get("box") else None
                if box:
                    stats["stored_box"] += 1
                else:
                    crop = fetch(base, p["crop"], cache)
                    hit = locate(img, crop) if crop is not None else None
                    if not hit:
                        stats["no_match"] += 1
                        continue
                    stats["matched"] += 1
                    box, _ = hit
                if all(iou(box, b) < 0.5 for b in g["boxes"]):  # same plate boxed in another report
                    g["boxes"].append(box)
            # Plates boxed but left out of the report (unreadable) are still plates.
            for e in r.get("extra") or []:
                if e.get("kind") != "skipped" or e.get("photo") != i:
                    continue
                box = stored_box(e, W, H)
                if box and all(iou(box, b) < 0.5 for b in g["boxes"]):
                    g["boxes"].append(box)
                    stats["skipped_boxes"] += 1

    keys = sorted(k for k, g in groups.items() if g["boxes"])
    # Photos from the previous run keep their side; new ones are split afresh.
    split = {k: prev_split[k] for k in keys if k in prev_split}
    fresh = [k for k in keys if k not in split]
    random.Random(0).shuffle(fresh)
    n_new_val = round(len(fresh) * VAL_SHARE)
    split.update({k: ("val" if i < n_new_val else "train") for i, k in enumerate(fresh)})
    n_val = sum(1 for k in keys if split[k] == "val")

    counts = {"train": [0, 0], "val": [0, 0]}
    for k in keys:
        g, part = groups[k], split[k]
        img, boxes = g["img"], g["boxes"]
        H, W = img.shape[:2]
        stem = Path(g["name"]).stem
        items = [(stem, img, boxes)]
        if part == "train" and max(W, H) > TILE * 1.15:
            for tx1, ty1, tx2, ty2 in tiles(W, H):
                inside = []
                for x1, y1, x2, y2 in boxes:
                    cx1, cy1, cx2, cy2 = max(x1, tx1), max(y1, ty1), min(x2, tx2), min(y2, ty2)
                    if cx2 <= cx1 or cy2 <= cy1:
                        continue
                    # Keep plates mostly inside the tile (clipped); drop slivers.
                    if (cx2 - cx1) * (cy2 - cy1) >= 0.6 * (x2 - x1) * (y2 - y1):
                        inside.append([cx1 - tx1, cy1 - ty1, cx2 - tx1, cy2 - ty1])
                items.append((f"{stem}_t{tx1}_{ty1}", img[ty1:ty2, tx1:tx2], inside))
        for s, im, bx in items:
            (out / "images" / part).mkdir(parents=True, exist_ok=True)
            (out / "labels" / part).mkdir(parents=True, exist_ok=True)
            cv2.imwrite(str(out / "images" / part / f"{s}.jpg"), im, [cv2.IMWRITE_JPEG_QUALITY, 95])
            h, w = im.shape[:2]
            (out / "labels" / part / f"{s}.txt").write_text("\n".join(yolo_lines(bx, w, h)))
            counts[part][0] += 1
        counts[part][1] += len(boxes)

    (out / "data.yaml").write_text(
        f"path: {out.resolve()}\ntrain: images/train\nval: images/val\nnames:\n  0: license_plate\n"
    )
    summary = {
        **stats,
        "photo_groups": len(keys),
        "new_photo_groups": len(fresh),
        "val_groups": n_val,
        "train_images": counts["train"][0],
        "train_plates": counts["train"][1],
        "val_images": counts["val"][0],
        "val_plates": counts["val"][1],
    }
    json.dump(summary, open(out / "summary.json", "w"), indent=2)
    json.dump({k: split[k] for k in keys}, open(out / "split.json", "w"), indent=2)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
