"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const VIEW = 320; // editor square, CSS px
const OUT = 512; // saved logo, px

type Bg = "white" | "transparent";

/**
 * Admin: replace the site logo (header, favicon, home-screen icon). Pick an
 * image, then drag to move, zoom and rotate it inside the square; the header
 * shows it as a circle, so a circle guide is drawn. Saves a 512 px PNG.
 */
export default function LogoEditor() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [angle, setAngle] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [bg, setBg] = useState<Bg>("white");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0); // busts the <img> cache of the current logo
  const view = useRef<HTMLCanvasElement>(null);
  const small = useRef<HTMLCanvasElement>(null);
  const tiny = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  /** Paint the edited logo into a size x size square (same picture at any size). */
  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, size: number) => {
      if (!img) return;
      const k = size / VIEW;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, size, size);
      if (bg === "white") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
      }
      const base = (fit === "cover" ? Math.max : Math.min)(VIEW / img.naturalWidth, VIEW / img.naturalHeight);
      ctx.translate(size / 2 + offset.x * k, size / 2 + offset.y * k);
      ctx.rotate((angle * Math.PI) / 180);
      const s = base * zoom * k;
      ctx.scale(s, s);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    },
    [img, zoom, angle, offset, fit, bg],
  );

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const c = view.current;
    if (c && img) {
      c.width = VIEW * dpr;
      c.height = VIEW * dpr;
      const ctx = c.getContext("2d")!;
      paint(ctx, VIEW * dpr);
      // Circle guide: the header shows the logo round.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = "rgba(47,143,230,.9)";
      ctx.setLineDash([8 * dpr, 6 * dpr]);
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.arc((VIEW * dpr) / 2, (VIEW * dpr) / 2, (VIEW * dpr) / 2 - dpr, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const [ref, size] of [
      [small, 40],
      [tiny, 32],
    ] as const) {
      const p = ref.current;
      if (!p || !img) continue;
      p.width = size * dpr;
      p.height = size * dpr;
      paint(p.getContext("2d")!, size * dpr);
    }
  }, [img, paint]);

  function open(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("เลือกไฟล์รูปภาพ");
    setError("");
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      setImg(im);
      setZoom(1);
      setAngle(0);
      setOffset({ x: 0, y: 0 });
      setFit("cover");
    };
    im.onerror = () => setError("เปิดรูปนี้ไม่ได้");
    im.src = url;
  }

  async function save() {
    if (!img) return;
    setBusy(true);
    setError("");
    const c = document.createElement("canvas");
    c.width = OUT;
    c.height = OUT;
    paint(c.getContext("2d")!, OUT);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    const form = new FormData();
    if (blob) form.append("file", blob, "logo.png");
    const res = await fetch("/api/admin/branding", { method: "POST", body: form }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "บันทึกไม่สำเร็จ");
    setImg(null);
    setVersion((v) => v + 1);
    setStatus("บันทึกแล้ว — หัวเว็บและไอคอนจะเปลี่ยนภายในไม่กี่นาที (ไอคอนแท็บอาจต้องรีเฟรช)");
  }

  async function reset() {
    if (!confirm("กลับไปใช้โลโก้เริ่มต้นของระบบ?")) return;
    setBusy(true);
    const res = await fetch("/api/admin/branding", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError("ไม่สำเร็จ");
    setVersion((v) => v + 1);
    setStatus("กลับไปใช้โลโก้เริ่มต้นแล้ว");
  }

  const slider = "w-full accent-[var(--color-brand)]";

  return (
    <section className="card flex flex-col gap-4 p-4">
      <div>
        <h2 className="font-bold">โลโก้และไอคอน</h2>
        <p className="text-sm text-ink-3">ใช้ที่หัวเว็บ (แสดงเป็นวงกลม) ไอคอนแท็บเบราว์เซอร์ และไอคอนเมื่อเพิ่มลงหน้าจอมือถือ</p>
      </div>

      {!img && (
        <div className="flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- the live logo, cache-busted after a change */}
          <img
            src={`/api/branding/logo?v=${version}`}
            alt="โลโก้ปัจจุบัน"
            className="h-24 w-24 rounded-full border border-line bg-white object-cover"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => input.current?.click()}>
              อัปโหลดโลโก้ใหม่
            </button>
            <button type="button" className="btn-ghost" disabled={busy} onClick={reset}>
              ใช้โลโก้เริ่มต้น
            </button>
          </div>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          open(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {img && (
        <div className="grid gap-4 md:grid-cols-[auto_1fr]">
          <canvas
            ref={view}
            style={{ width: VIEW, height: VIEW }}
            className="cursor-grab touch-none self-start rounded-xl border border-line bg-surface-2 active:cursor-grabbing"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (d) setOffset({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y });
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={(e) => setZoom((z) => Math.min(8, Math.max(0.1, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))))}
          />
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-xs text-ink-3">ลากรูปเพื่อเลื่อน · เลื่อนล้อเมาส์หรือแถบด้านล่างเพื่อซูม · เส้นประคือขอบวงกลมที่หัวเว็บ</p>
            <label className="flex flex-col gap-1">
              <span className="flex justify-between">
                <span className="font-medium">ขนาด (ซูม)</span>
                <span className="tabular-nums text-ink-3">{Math.round(zoom * 100)}%</span>
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
                <span className="tabular-nums text-ink-3">{angle}°</span>
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
            <div className="flex items-end gap-4 rounded-xl bg-paper p-3">
              <div className="flex flex-col items-center gap-1 text-xs text-ink-3">
                <canvas ref={small} style={{ width: 40, height: 40 }} className="rounded-full" />
                หัวเว็บ
              </div>
              <div className="flex flex-col items-center gap-1 text-xs text-ink-3">
                <canvas ref={tiny} style={{ width: 16, height: 16 }} />
                แท็บ
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={busy} onClick={save}>
                {busy ? "กำลังบันทึก…" : "บันทึกโลโก้"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => input.current?.click()}>
                เลือกรูปอื่น
              </button>
              <button type="button" className="btn-ghost" onClick={() => setImg(null)}>
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
      {status && <p className="text-sm text-emerald-400">{status}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
