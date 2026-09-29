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

/** Cut one plate out of a prepared photo, with a little padding for the OCR model. */
export async function cropPlate(photo: Blob, box: Box): Promise<Blob> {
  const bmp = await createImageBitmap(photo);
  if (box.rot) {
    // Level the plate: turn the photo about the plate's centre, then cut its own rectangle.
    const cx = (box.x + box.w / 2) * bmp.width;
    const cy = (box.y + box.h / 2) * bmp.height;
    const pw = box.rot.w * bmp.width * 1.04;
    const ph = box.rot.h * bmp.width * 1.04;
    const scale = Math.min(1, 800 / pw, 800 / ph);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(pw * scale));
    canvas.height = Math.max(1, Math.round(ph * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.rotate((-box.rot.angle * Math.PI) / 180);
    ctx.drawImage(bmp, -cx, -cy);
    bmp.close();
    return toJpeg(canvas, 0.92);
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

/** Plate boxes found by the AI detector (via /api/detect), normalized to the photo. */
export async function detectPlates(photo: { blob: Blob; width: number; height: number }): Promise<Box[]> {
  const form = new FormData();
  form.append("file", photo.blob, "photo.jpg");
  const { boxes } = await postForm<{
    boxes: { box: [number, number, number, number]; angle?: number; size?: [number, number] }[];
  }>("/api/detect", form);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return boxes
    .map(({ box: [x1, y1, x2, y2], angle, size }): Box => ({
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
export const rotateBox = (b: Box): Box => ({ x: 1 - (b.y + b.h), y: b.x, w: b.h, h: b.w });
