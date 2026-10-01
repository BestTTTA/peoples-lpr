// Where each plate sits in its full photo, kept with the report as training
// data for the plate detector (see training/). Coordinates are fractions of the
// photo (0–1); a tilted plate also has its angle and own size.

export type BoxSource =
  /** Found by the AI and kept by the finder. */
  | "ai"
  /** Drawn by the finder: a plate the AI missed (or AI was off). */
  | "manual"
  /** The whole photo is one plate (button, or the close-up fallback). */
  | "whole";

export type StoredBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  source: BoxSource;
  /** AI confidence, for AI boxes. */
  conf?: number;
  /** Tilted plates: degrees to turn counter-clockwise to level it… */
  angle?: number;
  /** …and its own width/height, as fractions of the photo's width. */
  pw?: number;
  ph?: number;
};

export type ExtraBox = StoredBox & {
  /** Index into the report's photos. */
  photo: number;
  /**
   * rejected: an AI box the finder deleted (not a plate, or a bad box);
   * skipped: a plate the finder boxed but left out of the report (unreadable).
   */
  kind: "rejected" | "skipped";
};

const SOURCES = new Set<BoxSource>(["ai", "manual", "whole"]);
const unit = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= -0.001 && v <= 1.001;
const round = (v: number) => Math.round(v * 1e5) / 1e5;

/** A box from a client, checked and rounded; null when unusable. */
export function sanitizeBox(input: unknown): StoredBox | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Record<string, unknown>;
  if (![b.x, b.y, b.w, b.h].every(unit) || (b.w as number) <= 0 || (b.h as number) <= 0) return null;
  const out: StoredBox = {
    x: round(b.x as number),
    y: round(b.y as number),
    w: round(b.w as number),
    h: round(b.h as number),
    source: SOURCES.has(b.source as BoxSource) ? (b.source as BoxSource) : "manual",
  };
  if (unit(b.conf)) out.conf = round(b.conf as number);
  if (typeof b.angle === "number" && Math.abs(b.angle) <= 90 && unit(b.pw) && unit(b.ph)) {
    out.angle = round(b.angle);
    out.pw = round(b.pw as number);
    out.ph = round(b.ph as number);
  }
  return out;
}

export function sanitizeExtraBoxes(input: unknown, photos: number): ExtraBox[] {
  if (!Array.isArray(input)) return [];
  const out: ExtraBox[] = [];
  for (const e of input.slice(0, 500)) {
    const box = sanitizeBox(e);
    const { photo, kind } = (e ?? {}) as Record<string, unknown>;
    if (!box || !Number.isInteger(photo) || (photo as number) < 0 || (photo as number) >= photos) continue;
    if (kind !== "rejected" && kind !== "skipped") continue;
    out.push({ ...box, photo: photo as number, kind });
  }
  return out;
}
