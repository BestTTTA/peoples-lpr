"""Score compare mode: for every set of 1-3 models, run each on the held-out
photos and keep, per photo, the model that found the most plates (ties: higher
mean confidence), as lib/detect-config.ts pickBest does in the app.

Picking the busiest model favours recall, and also the model that boxes the
most junk; this shows whether a set beats its best single model.

    python3 evaluate_combos.py ds conf name1=model1.pt name2=model2.pt ...
"""

import itertools
import json
import sys
import time
from pathlib import Path

from ultralytics import YOLO

from evaluate import detect, iou, load_val


def match(preds, gt):
    used, tp = set(), 0
    for p in sorted(preds, key=lambda b: -b[4]):
        best, bi = 0.0, -1
        for i, g in enumerate(gt):
            if i not in used and (v := iou(p, g)) > best:
                best, bi = v, i
        if best >= 0.5:
            used.add(bi)
            tp += 1
    return tp, len(preds) - tp, len(gt) - len(used)


def pick(per_model):
    mean = lambda bs: sum(b[4] for b in bs) / len(bs) if bs else 0.0  # noqa: E731
    return max(per_model, key=lambda bs: (len(bs), mean(bs)))


def main():
    ds, conf = Path(sys.argv[1]), float(sys.argv[2])
    models = dict(a.split("=", 1) for a in sys.argv[3:])
    items = load_val(ds)
    print(f"{len(items)} held-out photos, {sum(len(g) for _, _, g in items)} labelled plates, conf {conf}")

    found, ms = {}, {}
    for name, path in models.items():
        m = YOLO(path, task="detect")
        t0 = time.time()
        found[name] = [detect(m, img, conf) for _, img, _ in items]
        ms[name] = (time.time() - t0) / len(items) * 1000

    rows = []
    for k in (1, 2, 3):
        for combo in itertools.combinations(models, k):
            tp = fp = fn = 0
            win = dict.fromkeys(combo, 0)
            for i, (_, _, gt) in enumerate(items):
                chosen = pick([found[n][i] for n in combo])
                win[next(n for n in combo if found[n][i] is chosen)] += 1
                a, b, c = match(chosen, gt)
                tp, fp, fn = tp + a, fp + b, fn + c
            p, r = tp / max(1, tp + fp), tp / max(1, tp + fn)
            rows.append({
                "models": "+".join(combo), "tp": tp, "fp": fp, "fn": fn,
                "precision": round(p, 3), "recall": round(r, 3), "f1": round(2 * p * r / max(1e-9, p + r), 3),
                "picked": win, "ms_per_photo": round(sum(ms[n] for n in combo)),
            })
    rows.sort(key=lambda x: (-x["f1"], -x["recall"]))
    for x in rows:
        print(json.dumps(x, ensure_ascii=False))
    json.dump(rows, open(ds / f"combos-{conf}.json", "w"), indent=2)


if __name__ == "__main__":
    main()
