import "server-only";
import { DEFAULT_MODELS, type DetectSettings, type ModelChoice, sanitizeDetect, sanitizeModels } from "./detect-config";
import { getSetting, setSetting } from "./store";

const KEY = "detect";

/** Defaults when nothing is saved yet: env, then built-in values. */
export const DETECT_DEFAULTS: DetectSettings = sanitizeDetect({
  conf: process.env.CROP_CONF ?? 0.25,
  iou: process.env.CROP_IOU ?? 0.45,
  imgsz: process.env.CROP_IMGSZ ?? 640,
  aspectMin: 1.1,
  aspectMax: 3.6,
})!;

// Read on every detect call; a short cache keeps that off the database.
let cached: { at: number; value: DetectSettings } | null = null;
const TTL = 10_000;

export async function getDetectSettings(): Promise<DetectSettings> {
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  const saved = sanitizeDetect(await getSetting(KEY).catch(() => null));
  const value = saved ?? DETECT_DEFAULTS;
  cached = { at: Date.now(), value };
  return value;
}

export async function saveDetectSettings(value: DetectSettings): Promise<void> {
  await setSetting(KEY, value);
  cached = { at: Date.now(), value };
}

// Model choice (single / compare), same caching.
const MODELS_KEY = "detect-models";
let cachedModels: { at: number; value: ModelChoice } | null = null;

export async function getModelChoice(): Promise<ModelChoice> {
  if (cachedModels && Date.now() - cachedModels.at < TTL) return cachedModels.value;
  const value = sanitizeModels(await getSetting(MODELS_KEY).catch(() => null)) ?? DEFAULT_MODELS;
  cachedModels = { at: Date.now(), value };
  return value;
}

export async function saveModelChoice(value: ModelChoice): Promise<void> {
  await setSetting(MODELS_KEY, value);
  cachedModels = { at: Date.now(), value };
}
