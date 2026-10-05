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
  /** Tiled inference: window size in px, 0 = off. */
  tileSize: number;
  /** How much neighbouring tiles overlap (fraction). */
  tileOverlap: number;
  /** Also search the photo turned ± this many degrees, for tilted plates; 0 = off. */
  tiltAngle: number;
};

export const DETECT_LIMITS: Record<keyof DetectSettings, { min: number; max: number; step: number; label: string; hint: string }> = {
  conf: { min: 0.01, max: 0.95, step: 0.01, label: "ความมั่นใจขั้นต่ำ (confidence)", hint: "ต่ำ = เจอป้ายมากขึ้นแต่กรอบผิดมากขึ้น · สูง = กรอบน้อยแต่แม่น" },
  iou: { min: 0.1, max: 0.95, step: 0.05, label: "ตัดกรอบซ้อน (IOU / NMS)", hint: "ต่ำ = ลบกรอบที่ทับกันมากขึ้น เหมาะกับป้ายวางชิดกัน" },
  imgsz: { min: 320, max: 1280, step: 32, label: "ขนาดภาพเข้าโมเดล (imgsz)", hint: "ใช้ค่าที่โมเดล train มา (ส่วนใหญ่ 640) · ใหญ่ขึ้นช้าลง" },
  aspectMin: { min: 0.5, max: 3, step: 0.1, label: "สัดส่วนกรอบต่ำสุด (กว้าง÷สูง)", hint: "ตัดกรอบที่แคบ/สูงเกินกว่าจะเป็นป้าย" },
  aspectMax: { min: 1.5, max: 8, step: 0.1, label: "สัดส่วนกรอบสูงสุด (กว้าง÷สูง)", hint: "ตัดกรอบที่กว้างเกิน เช่นกรอบคร่อมป้ายทั้งแถว · ป้ายไทยจริงถึง ~3.4" },
  tileSize: { min: 0, max: 1280, step: 32, label: "แบ่งภาพเป็นชิ้น (tiling) ขนาดชิ้น px", hint: "0 = ปิด · แบ่งรูปเป็นชิ้นซ้อนกันแล้วหาป้ายทีละชิ้น ช่วยมากกับรูปแนวตั้ง/รูปที่มีป้ายเยอะ (ทดสอบ: เจอเพิ่ม 2 เท่า) · ช้าลงตามจำนวนชิ้น" },
  tiltAngle: { min: 0, max: 60, step: 5, label: "หาป้ายเอียง (องศา)", hint: "0 = ปิด · หมุนรูปไป ± เท่านี้แล้วหาอีกรอบ เพื่อจับป้ายที่เอียงเกิน ~30° และส่งป้ายที่หมุนตรงแล้วให้ OCR · ช้าลงประมาณ 3 เท่า" },
  tileOverlap: { min: 0.1, max: 0.5, step: 0.05, label: "ชิ้นซ้อนกัน (overlap)", hint: "ควรกว้างกว่าป้าย 1 ป้ายในรูป เพื่อให้ป้ายที่ถูกตัดขอบชิ้นเห็นเต็มในชิ้นข้าง ๆ" },
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
    out[k] = k === "imgsz" || k === "tileSize" ? Math.round(clamped / step) * step : Math.round(clamped * 1000) / 1000;
    // Tiles smaller than the model input make no sense: treat as off.
    if (k === "tileSize" && out[k] < 320) out[k] = 0;
  }
  if (out.aspectMin >= out.aspectMax) return null;
  return out;
}

export type RawBox = {
  box: [number, number, number, number];
  conf: number;
  /** Tilted plates: degrees to turn counter-clockwise to level it, and its own width/height. */
  angle?: number;
  size?: [number, number];
};

/** Does a detector box look like a plate under these settings? (Tilted ones by their own shape.) */
export function plateShaped({ box: [x1, y1, x2, y2], size }: RawBox, s: DetectSettings): boolean {
  const [w, h] = size ?? [x2 - x1, y2 - y1];
  const ratio = w / Math.max(1, h);
  return ratio >= s.aspectMin && ratio <= s.aspectMax;
}

/** Which detector model(s) auto-crop uses. */
export type ModelChoice = {
  /** "compare": run every chosen model on each photo and keep the one that finds the most plates. */
  mode: "single" | "compare";
  primary: string;
  /** The second model in compare mode. */
  compare: string | null;
  /** An optional third model in compare mode. */
  compare2: string | null;
};

export const DEFAULT_MODELS: ModelChoice = { mode: "single", primary: "builtin", compare: null, compare2: null };

/** The models a choice runs, primary first. */
export function chosenModels(c: ModelChoice): string[] {
  return c.mode === "compare" ? [c.primary, c.compare, c.compare2].filter((m): m is string => !!m) : [c.primary];
}

const MODEL_ID = /^(builtin|[a-z0-9-]{1,64})$/;

export function sanitizeModels(input: unknown): ModelChoice | null {
  if (!input || typeof input !== "object") return null;
  const { mode, primary, compare, compare2 } = input as Record<string, unknown>;
  if (mode !== "single" && mode !== "compare") return null;
  if (typeof primary !== "string" || !MODEL_ID.test(primary)) return null;
  const second = typeof compare === "string" && MODEL_ID.test(compare) ? compare : null;
  if (mode === "compare" && (!second || second === primary)) return null;
  // Saved before the third slot existed, or left empty: two models.
  const third = typeof compare2 === "string" && MODEL_ID.test(compare2) ? compare2 : null;
  if (third && (third === primary || third === second)) return null;
  return { mode, primary, compare: second, compare2: third };
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
