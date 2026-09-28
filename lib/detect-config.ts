// Auto-crop detector settings, shared by the admin page (browser) and the API.

export type DetectSettings = {
  /** Minimum detector confidence. */
  conf: number;
  /** NMS overlap threshold: lower drops more overlapping boxes. */
  iou: number;
  /** Model input size (multiple of 32). */
  imgsz: number;
  /** Plate-shaped boxes only: width / height within [aspectMin, aspectMax]. */
  aspectMin: number;
  aspectMax: number;
};

export const DETECT_LIMITS: Record<keyof DetectSettings, { min: number; max: number; step: number; label: string; hint: string }> = {
  conf: { min: 0.01, max: 0.95, step: 0.01, label: "ความมั่นใจขั้นต่ำ (confidence)", hint: "ต่ำ = เจอป้ายมากขึ้นแต่กรอบผิดมากขึ้น · สูง = กรอบน้อยแต่แม่น" },
  iou: { min: 0.1, max: 0.95, step: 0.05, label: "ตัดกรอบซ้อน (IOU / NMS)", hint: "ต่ำ = ลบกรอบที่ทับกันมากขึ้น เหมาะกับป้ายวางชิดกัน" },
  imgsz: { min: 320, max: 1280, step: 32, label: "ขนาดภาพเข้าโมเดล (imgsz)", hint: "ใช้ค่าที่โมเดล train มา (ส่วนใหญ่ 640) · ใหญ่ขึ้นช้าลง" },
  aspectMin: { min: 0.5, max: 3, step: 0.1, label: "สัดส่วนกรอบต่ำสุด (กว้าง÷สูง)", hint: "ตัดกรอบที่แคบ/สูงเกินกว่าจะเป็นป้าย" },
  aspectMax: { min: 1.5, max: 8, step: 0.1, label: "สัดส่วนกรอบสูงสุด (กว้าง÷สูง)", hint: "ตัดกรอบที่กว้างเกิน เช่นกรอบคร่อมป้ายทั้งแถว · ป้ายไทยจริงถึง ~3.4" },
};

export const DETECT_KEYS = Object.keys(DETECT_LIMITS) as (keyof DetectSettings)[];

/** Clamp and round user input into valid settings; null if anything is missing or not a number. */
export function sanitizeDetect(input: unknown): DetectSettings | null {
  if (!input || typeof input !== "object") return null;
  const out = {} as DetectSettings;
  for (const k of DETECT_KEYS) {
    const v = Number((input as Record<string, unknown>)[k]);
    if (!Number.isFinite(v)) return null;
    const { min, max, step } = DETECT_LIMITS[k];
    const clamped = Math.min(max, Math.max(min, v));
    out[k] = k === "imgsz" ? Math.round(clamped / step) * step : Math.round(clamped * 1000) / 1000;
  }
  if (out.aspectMin >= out.aspectMax) return null;
  return out;
}

export type RawBox = { box: [number, number, number, number]; conf: number };

/** Does a detector box look like a plate under these settings? */
export function plateShaped({ box: [x1, y1, x2, y2] }: RawBox, s: DetectSettings): boolean {
  const ratio = (x2 - x1) / Math.max(1, y2 - y1);
  return ratio >= s.aspectMin && ratio <= s.aspectMax;
}

/** Which detector model(s) auto-crop uses. */
export type ModelChoice = {
  /** "compare": run both models on each photo and keep the one that finds more plates. */
  mode: "single" | "compare";
  primary: string;
  /** The second model in compare mode. */
  compare: string | null;
};

export const DEFAULT_MODELS: ModelChoice = { mode: "single", primary: "builtin", compare: null };

const MODEL_ID = /^(builtin|[a-z0-9-]{1,64})$/;

export function sanitizeModels(input: unknown): ModelChoice | null {
  if (!input || typeof input !== "object") return null;
  const { mode, primary, compare } = input as Record<string, unknown>;
  if (mode !== "single" && mode !== "compare") return null;
  if (typeof primary !== "string" || !MODEL_ID.test(primary)) return null;
  const second = typeof compare === "string" && MODEL_ID.test(compare) ? compare : null;
  if (mode === "compare" && (!second || second === primary)) return null;
  return { mode, primary, compare: second };
}

export type Candidate = {
  model: string;
  /** Plate-shaped boxes (what the finder gets). */
  boxes: RawBox[];
  /** Everything the model returned, before the shape filter. */
  raw: RawBox[];
  error?: string;
};

/** Compare mode's pick: more plates wins; on a tie, higher mean confidence; then the primary. */
export function pickBest(candidates: Candidate[]): Candidate | null {
  const ok = candidates.filter((c) => !c.error);
  if (ok.length === 0) return null;
  const mean = (c: Candidate) => (c.boxes.length ? c.boxes.reduce((s, b) => s + b.conf, 0) / c.boxes.length : 0);
  return ok.reduce((best, c) =>
    c.boxes.length > best.boxes.length || (c.boxes.length === best.boxes.length && mean(c) > mean(best)) ? c : best,
  );
}
