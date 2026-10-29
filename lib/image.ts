"use client";
import { postForm } from "./post";

/** Normalized (0–1) rectangle relative to the photo. */
export type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * A tilted plate found by the AI: degrees to turn it counter-clockwise to
   * level it, and its own width/height as fractions of the photo's width.
   * The crop is levelled, which OCR reads far better.
   */
  rot?: { angle: number; w: number; h: number };
  /** Who made the box (kept with the report as training data); absent = drawn by hand. */
  source?: "ai" | "manual" | "whole";
  /** AI confidence, for AI boxes. */
  conf?: number;
};

const MAX_EDGE = 2000;

function toJpeg(canvas: HTMLCanvasElement, quality = 0.88): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", quality),
  );
}

/** Decode (honouring EXIF rotation), downscale and re-encode an uploaded photo. */
export async function preparePhoto(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return { blob: await toJpeg(canvas), width: canvas.width, height: canvas.height };
}

/**
 * Drop the empty margins around the photo in `canvas` and fill the wedges a turned photo leaves in its
 * corners with the photo's average colour. Black wedges made the OCR misread, and shrinking the crop to
 * dodge them cut the plate's own edge off (a photo taken close to the plate has nothing to spare).
 */
function fillAround(canvas: HTMLCanvasElement, bmp: ImageBitmap): HTMLCanvasElement {
  const { width: w, height: h } = canvas;
  const { data } = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, w, h);
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < x0 || y1 < y0) return canvas;
  const avg = document.createElement("canvas");
  avg.width = 1;
  avg.height = 1;
  const actx = avg.getContext("2d", { willReadFrequently: true })!;
  actx.drawImage(bmp, 0, 0, 1, 1);
  const [r, g, b] = actx.getImageData(0, 0, 1, 1).data;
  const sw = x1 - x0 + 1;
  const sh = y1 - y0 + 1;
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(canvas, x0, y0, sw, sh, 0, 0, sw, sh);
  return out;
}

/** Turn the photo about (cx, cy) by `angle` degrees counter-clockwise, then cut a pw x ph rectangle there. */
function cutLevel(
  bmp: ImageBitmap,
  cx: number,
  cy: number,
  pw: number,
  ph: number,
  angle: number,
  fill = false,
): Promise<Blob> {
  const scale = Math.min(1, 800 / pw, 800 / ph);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(pw * scale));
  canvas.height = Math.max(1, Math.round(ph * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(scale, scale);
  ctx.rotate((-angle * Math.PI) / 180);
  ctx.drawImage(bmp, -cx, -cy);
  return toJpeg(fill ? fillAround(canvas, bmp) : canvas, 0.92);
}

/** Cut one plate out of a prepared photo, with a little padding for the OCR model. */
export async function cropPlate(photo: Blob, box: Box): Promise<Blob> {
  const bmp = await createImageBitmap(photo);
  if (box.rot) {
    // Level the plate: turn the photo about the plate's centre, then cut its own rectangle.
    const cx = (box.x + box.w / 2) * bmp.width;
    const cy = (box.y + box.h / 2) * bmp.height;
    const out = await cutLevel(bmp, cx, cy, box.rot.w * bmp.width * 1.04, box.rot.h * bmp.width * 1.04, box.rot.angle);
    bmp.close();
    return out;
  }
  const pad = 0.02;
  const x0 = Math.max(0, box.x - pad * box.w) * bmp.width;
  const y0 = Math.max(0, box.y - pad * box.h) * bmp.height;
  const x1 = Math.min(1, box.x + box.w * (1 + pad)) * bmp.width;
  const y1 = Math.min(1, box.y + box.h * (1 + pad)) * bmp.height;
  const sw = Math.max(1, x1 - x0);
  const sh = Math.max(1, y1 - y0);
  const scale = Math.min(1, 800 / sw, 800 / sh);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext("2d")!.drawImage(bmp, x0, y0, sw, sh, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return toJpeg(canvas, 0.92);
}

/**
 * The plate cut out of its photo again, turned a further `tilt` degrees (see
 * estimateTilt) beyond whatever the detector already turned it. Cutting from the
 * photo, not turning the old crop, keeps the plate's corners that a crop with
 * black wedges has lost. Two crops come back: level, and level upside down,
 * since a text line's tilt does not say which end is up.
 */
export async function recutLevel(photo: Blob, box: Box, tilt: number): Promise<Blob[]> {
  const bmp = await createImageBitmap(photo);
  try {
    const cx = (box.x + box.w / 2) * bmp.width;
    const cy = (box.y + box.h / 2) * bmp.height;
    let pw: number;
    let ph: number;
    if (box.rot) {
      pw = box.rot.w * bmp.width * 1.15;
      ph = box.rot.h * bmp.width * 1.25;
    } else {
      // An upright box around a tilted plate: a wide rectangle that still holds the plate once level.
      const longest = Math.max(box.w * bmp.width, box.h * bmp.height);
      pw = longest * 1.1;
      ph = longest * 0.8;
    }
    const angle = (box.rot?.angle ?? 0) + tilt;
    return await Promise.all([
      cutLevel(bmp, cx, cy, pw, ph, angle, true),
      cutLevel(bmp, cx, cy, pw, ph, angle + 180, true),
    ]);
  } finally {
    bmp.close();
  }
}

/** A crop turned half a turn: for a plate photographed the wrong way up, which has no tilt to find. */
export async function upsideDown(crop: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(crop);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width, canvas.height);
  ctx.rotate(Math.PI);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return toJpeg(canvas, 0.92);
}

/**
 * A plate cut out taller than wide is lying on its side, and the OCR cannot read
 * it. Returns that crop turned a quarter each way (clockwise, then
 * counter-clockwise) so the reader can try both; [] for a level crop.
 */
export async function sidewaysCrops(crop: Blob): Promise<Blob[]> {
  const bmp = await createImageBitmap(crop);
  try {
    if (bmp.height <= bmp.width) return [];
    const turn = (quarter: 1 | -1) => {
      const canvas = document.createElement("canvas");
      canvas.width = bmp.height;
      canvas.height = bmp.width;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((quarter * Math.PI) / 2);
      ctx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
      return toJpeg(canvas, 0.92);
    };
    return await Promise.all([turn(1), turn(-1)]);
  } finally {
    bmp.close();
  }
}

/** Plate boxes found by the AI detector (via /api/detect), normalized to the photo. */
export async function detectPlates(photo: { blob: Blob; width: number; height: number }): Promise<Box[]> {
  const form = new FormData();
  form.append("file", photo.blob, "photo.jpg");
  const { boxes } = await postForm<{
    boxes: { box: [number, number, number, number]; conf?: number; angle?: number; size?: [number, number] }[];
  }>("/api/detect", form);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return boxes
    .map(({ box: [x1, y1, x2, y2], conf, angle, size }): Box => ({
      source: "ai",
      ...(conf !== undefined ? { conf } : {}),
      x: clamp(x1 / photo.width),
      y: clamp(y1 / photo.height),
      w: clamp((x2 - x1) / photo.width),
      h: clamp((y2 - y1) / photo.height),
      ...(angle && size ? { rot: { angle, w: size[0] / photo.width, h: size[1] / photo.width } } : {}),
    }))
    .filter((b) => b.w > 0.01 && b.h > 0.01)
    // Reading order (top-to-bottom, then left-to-right) so numbering follows the photo.
    .sort((a, b) => (Math.abs(a.y - b.y) > Math.min(a.h, b.h) / 2 ? a.y - b.y : a.x - b.x));
}

/** Turn a prepared photo 90° clockwise. */
export async function rotatePhoto(photo: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const bmp = await createImageBitmap(photo);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.height;
  canvas.height = bmp.width;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return { blob: await toJpeg(canvas), width: canvas.width, height: canvas.height };
}

/** Where a box lands when its photo turns 90° clockwise (normalized coordinates). */
export const rotateBox = (b: Box): Box => ({
  x: 1 - (b.y + b.h),
  y: b.x,
  w: b.h,
  h: b.w,
  ...(b.source ? { source: b.source } : {}),
  ...(b.conf !== undefined ? { conf: b.conf } : {}),
});
