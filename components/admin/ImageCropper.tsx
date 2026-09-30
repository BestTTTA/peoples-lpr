"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type CropPreview = { label: string; w: number; h: number; round?: boolean };

/**
 * Admin image editor: fit a picture into a fixed-ratio frame by dragging,
 * zooming (slider or wheel) and rotating, then export it at an exact size.
 * Used for the logo (square, round guide) and the share image (1200x630).
 */
export default function ImageCropper({
  image,
  outW,
  outH,
  mime,
  quality = 0.9,
  round = false,
  transparentOption = false,
  previews = [],
  saving,
  onSave,
  onCancel,
  onPickOther,
}: {
  image: HTMLImageElement;
  outW: number;
  outH: number;
  mime: "image/png" | "image/jpeg";
  quality?: number;
  /** Draw a circle guide (the header shows the logo round). */
  round?: boolean;
  /** Offer a transparent background (PNG only). */
  transparentOption?: boolean;
  previews?: CropPreview[];
  saving: boolean;
  onSave: (blob: Blob) => void;
  onCancel: () => void;
  onPickOther: () => void;
}) {
  // Editor frame in "view" units; the canvas may render smaller on phones.
  const VIEW_W = outW >= outH ? 480 : 320;
  const VIEW_H = Math.round((VIEW_W * outH) / outW);
  const [zoom, setZoom] = useState(1);
  const [angle, setAngle] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [bg, setBg] = useState<"white" | "transparent">("white");
  const view = useRef<HTMLCanvasElement>(null);
  const previewRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; k: number } | null>(null);

  /** Paint the edited picture into a w x h canvas (same framing at any size). */
  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const k = w / VIEW_W;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (bg === "white" || mime === "image/jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }
      const base = (fit === "cover" ? Math.max : Math.min)(VIEW_W / image.naturalWidth, VIEW_H / image.naturalHeight);
      ctx.translate(w / 2 + offset.x * k, h / 2 + offset.y * k);
      ctx.rotate((angle * Math.PI) / 180);
      const s = base * zoom * k;
      ctx.scale(s, s);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    },
    [image, zoom, angle, offset, fit, bg, mime, VIEW_W, VIEW_H],
  );

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const c = view.current;
    if (c) {
      c.width = VIEW_W * dpr;
      c.height = VIEW_H * dpr;
      const ctx = c.getContext("2d")!;
      paint(ctx, c.width, c.height);
      if (round) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.strokeStyle = "rgba(47,143,230,.9)";
        ctx.setLineDash([8 * dpr, 6 * dpr]);
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.arc(c.width / 2, c.height / 2, Math.min(c.width, c.height) / 2 - dpr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    previews.forEach((p, i) => {
      const pc = previewRefs.current[i];
      if (!pc) return;
      pc.width = p.w * dpr;
      pc.height = p.h * dpr;
      paint(pc.getContext("2d")!, pc.width, pc.height);
    });
  }, [paint, round, previews, VIEW_W, VIEW_H]);

  async function save() {
    const c = document.createElement("canvas");
    c.width = outW;
    c.height = outH;
    paint(c.getContext("2d")!, outW, outH);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, mime, quality));
    if (blob) onSave(blob);
  }

  const slider = "w-full accent-[var(--color-brand)]";

  return (
    <div className="flex flex-col gap-4">
      <canvas
        ref={view}
        style={{ width: VIEW_W, height: VIEW_H, maxWidth: "100%", aspectRatio: `${outW} / ${outH}` }}
        className="cursor-grab touch-none self-start rounded-xl border border-line bg-surface-2 active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          // Pointer px -> view units, in case the canvas is drawn smaller than VIEW_W.
          const k = VIEW_W / e.currentTarget.clientWidth;
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y, k };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) setOffset({ x: d.ox + (e.clientX - d.x) * d.k, y: d.oy + (e.clientY - d.y) * d.k });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onWheel={(e) => setZoom((z) => Math.min(8, Math.max(0.1, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))))}
      />
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-xs text-ink-3">
          ลากรูปเพื่อเลื่อน · เลื่อนล้อเมาส์หรือแถบด้านล่างเพื่อซูม
          {round && " · เส้นประคือขอบวงกลมที่หัวเว็บ"} · บันทึกขนาด {outW}×{outH} px
        </p>
        <label className="flex flex-col gap-1">
          <span className="flex justify-between">
            <span className="font-medium">ขนาด (ซูม)</span>
            <span className="text-ink-3 tabular-nums">{Math.round(zoom * 100)}%</span>
          </span>
          <input
            type="range"
            className={slider}
            min={-2.3}
            max={2.1}
            step={0.01}
            value={Math.log(zoom)}
            onChange={(e) => setZoom(Math.exp(Number(e.target.value)))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="flex justify-between">
            <span className="font-medium">หมุน</span>
            <span className="text-ink-3 tabular-nums">{angle}°</span>
          </span>
          <input
            type="range"
            className={slider}
            min={-180}
            max={180}
            step={1}
            value={angle}
            onChange={(e) => setAngle(Number(e.target.value))}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setAngle((a) => ((a - 90 + 540) % 360) - 180)}>
            ↺ 90°
          </button>
          <button type="button" className="btn-ghost px-3 py-1.5" onClick={() => setAngle((a) => ((a + 90 + 540) % 360) - 180)}>
            ↻ 90°
          </button>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5"
            onClick={() => {
              setFit((f) => (f === "cover" ? "contain" : "cover"));
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
          >
            {fit === "cover" ? "ย่อให้เห็นทั้งรูป" : "ขยายเต็มกรอบ"}
          </button>
          <button
            type="button"
            className="btn-ghost px-3 py-1.5"
            onClick={() => {
              setZoom(1);
              setAngle(0);
              setOffset({ x: 0, y: 0 });
            }}
          >
            รีเซ็ต
          </button>
        </div>
        {transparentOption && mime === "image/png" && (
          <div className="flex items-center gap-2">
            <span className="font-medium">พื้นหลัง</span>
            {(
              [
                ["white", "ขาว"],
                ["transparent", "โปร่งใส"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setBg(k)}
                className={`rounded-lg px-3 py-1 ${bg === k ? "bg-brand text-white" : "bg-surface-2 text-ink-3"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {previews.length > 0 && (
          <div className="flex flex-wrap items-end gap-4 rounded-xl bg-paper p-3">
            {previews.map((p, i) => (
              <div key={p.label} className="flex flex-col items-center gap-1 text-xs text-ink-3">
                <canvas
                  ref={(el) => {
                    previewRefs.current[i] = el;
                  }}
                  style={{ width: p.w, height: p.h }}
                  className={p.round ? "rounded-full" : "rounded"}
                />
                {p.label}
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={saving} onClick={save}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
          <button type="button" className="btn-ghost" onClick={onPickOther}>
            เลือกรูปอื่น
          </button>
          <button type="button" className="btn-ghost" onClick={onCancel}>
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}

/** Load a picked file as an image element. */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("เลือกไฟล์รูปภาพ"));
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("เปิดรูปนี้ไม่ได้"));
    im.src = URL.createObjectURL(file);
  });
}
