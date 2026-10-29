const SIDE = 160;

/**
 * How far a plate crop is tilted: the direction of its text lines and frame, in
 * degrees clockwise from horizontal, in (-90, 90]. 0 is level.
 *
 * Edges along a line all land in the same few rows once the crop is projected
 * across that line, so the tilt is the angle where the projection is the
 * spikiest. Only the middle of the crop counts, so the black corners left by a
 * rotated crop do not vote.
 */
export async function estimateTilt(crop: Blob): Promise<number> {
  const bmp = await createImageBitmap(crop);
  const scale = Math.min(1, SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(8, Math.round(bmp.width * scale));
  const h = Math.max(8, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const { data } = ctx.getImageData(0, 0, w, h);

  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];

  // Edge points: position (from the centre) and gradient, inside an ellipse.
  const px: number[] = [];
  const py: number[] = [];
  const gx: number[] = [];
  const gy: number[] = [];
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const dx = (x - cx) / (w / 2);
      const dy = (y - cy) / (h / 2);
      if (dx * dx + dy * dy > 0.7) continue;
      const i = y * w + x;
      const sx =
        gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1] - gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1];
      const sy =
        gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1] - gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1];
      if (sx * sx + sy * sy < 40 * 40) continue;
      px.push(x - cx);
      py.push(y - cy);
      gx.push(sx);
      gy.push(sy);
    }
  if (px.length < 30) return 0;

  const reach = Math.ceil(Math.hypot(w, h));
  const bins = new Float64Array(2 * reach + 1);
  const score = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    const nx = -Math.sin(rad);
    const ny = Math.cos(rad);
    bins.fill(0);
    for (let i = 0; i < px.length; i++) {
      // Rows across the line; an edge counts by how squarely it faces them.
      bins[Math.round(px[i] * nx + py[i] * ny) + reach] += Math.abs(gx[i] * nx + gy[i] * ny);
    }
    let s = 0;
    for (let i = 0; i < bins.length; i++) s += bins[i] * bins[i];
    return s;
  };

  let best = 0;
  let bestScore = -1;
  for (let deg = -88; deg <= 90; deg += 2) {
    const s = score(deg);
    if (s > bestScore) {
      bestScore = s;
      best = deg;
    }
  }
  for (let deg = best - 2; deg <= best + 2; deg += 0.5) {
    const s = score(deg);
    if (s > bestScore) {
      bestScore = s;
      best = deg;
    }
  }
  return best;
}
