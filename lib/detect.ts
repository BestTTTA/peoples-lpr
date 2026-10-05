import "server-only";
import {
  type Candidate,
  type DetectSettings,
  type ModelChoice,
  type RawBox,
  chosenModels,
  pickBest,
  plateShaped,
} from "./detect-config";
import { CROP_BASE, cropFetch } from "./crop-service";

/** One model's answer for one image. Never throws: failures come back as `error`. */
async function runModel(file: Blob, model: string, s: DetectSettings): Promise<Candidate> {
  const form = new FormData();
  form.append("file", file, "photo.jpg");
  form.append("model", model);
  form.append("conf", String(s.conf));
  form.append("iou", String(s.iou));
  form.append("imgsz", String(s.imgsz));
  form.append("tile", String(s.tileSize));
  form.append("overlap", String(s.tileOverlap));
  form.append("aspect_min", String(s.aspectMin));
  form.append("aspect_max", String(s.aspectMax));
  form.append("tilt", String(s.tiltAngle));
  try {
    const res = await cropFetch("/crops", { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
    const data = (await res.json().catch(() => ({}))) as {
      crops?: { box?: number[]; conf?: number; angle?: number; size?: number[] }[];
    };
    if (!res.ok || !data.crops) throw new Error(`crop service ${res.status} at ${CROP_BASE}`);
    const raw = data.crops
      .filter((c) => c.box?.length === 4)
      .map(
        (c): RawBox => ({
          box: c.box as RawBox["box"],
          conf: c.conf ?? 0,
          ...(c.angle && c.size?.length === 2 ? { angle: c.angle, size: c.size as [number, number] } : {}),
        }),
      );
    // On photos of many plates detectors also box whole rows; those are far wider than any plate.
    return { model, raw, boxes: raw.filter((b) => plateShaped(b, s)) };
  } catch (err) {
    return { model, raw: [], boxes: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Detect plates with the configured model(s). In compare mode they all run in
 * parallel and the one that finds the most plates wins; if one fails, the
 * others still answer.
 */
export async function detect(
  file: Blob,
  settings: DetectSettings,
  choice: ModelChoice,
): Promise<{ best: Candidate | null; candidates: Candidate[] }> {
  const models = chosenModels(choice);
  const candidates = await Promise.all(models.map((m) => runModel(file, m, settings)));
  // A configured model that vanished (deleted, bad volume) should not stop auto-crop.
  if (candidates.every((c) => c.error) && !models.includes("builtin"))
    candidates.push(await runModel(file, "builtin", settings));
  return { best: pickBest(candidates), candidates };
}
