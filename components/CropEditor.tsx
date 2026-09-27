"use client";
import { useRef, useState } from "react";
import type { Box } from "@/lib/image";

const MIN = 0.02;

/** Drag on the photo to draw one box per plate. */
export default function CropEditor({
  src,
  width,
  height,
  boxes,
  onChange,
  numberOffset = 0,
}: {
  src: string;
  width: number;
  height: number;
  boxes: Box[];
  onChange: (boxes: Box[]) => void;
  /** Plates from earlier photos, so labels count across the whole upload. */
  numberOffset?: number;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);

  function point(e: React.PointerEvent) {
    const r = layer.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  function rect(a: { x: number; y: number }, b: { x: number; y: number }): Box {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
  }

  return (
    <div className="flex justify-center rounded-xl bg-black/60 p-2">
      <div className="relative max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
        <img
          src={src}
          width={width}
          height={height}
          alt="รูปที่อัปโหลด"
          className="block h-auto max-h-[62vh] w-auto max-w-full select-none"
          draggable={false}
        />
        <div
          ref={layer}
          className="absolute inset-0 cursor-crosshair touch-none"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            start.current = point(e);
            setDraft(null);
          }}
          onPointerMove={(e) => {
            if (start.current) setDraft(rect(start.current, point(e)));
          }}
          onPointerUp={(e) => {
            if (!start.current) return;
            const b = rect(start.current, point(e));
            start.current = null;
            setDraft(null);
            if (b.w > MIN && b.h > MIN) onChange([...boxes, b]);
          }}
          onPointerCancel={() => {
            start.current = null;
            setDraft(null);
          }}
        >
          {boxes.map((b, i) => (
            <div
              key={i}
              className="absolute rounded-sm border-2 border-cyan bg-cyan/15 shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
              style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` }}
            >
              <span className="absolute -top-0.5 -left-0.5 rounded-br-md bg-brand px-1.5 text-xs font-bold text-white">
                {numberOffset + i + 1}
              </span>
              <button
                type="button"
                aria-label={`ลบกรอบที่ ${numberOffset + i + 1}`}
                className="absolute -top-3 -right-3 grid h-6 w-6 place-items-center rounded-full bg-red-500 text-sm font-bold text-white shadow"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onChange(boxes.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
          {draft && (
            <div
              className="absolute rounded-sm border-2 border-dashed border-white bg-white/10"
              style={{
                left: `${draft.x * 100}%`,
                top: `${draft.y * 100}%`,
                width: `${draft.w * 100}%`,
                height: `${draft.h * 100}%`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
