"use client";
import { useRef, useState } from "react";
import ImageCropper, { loadImage } from "@/components/admin/ImageCropper";

const LOGO_PREVIEWS = [
  { label: "หัวเว็บ", w: 40, h: 40, round: true },
  { label: "แท็บ", w: 16, h: 16 },
];

/** Admin: replace the site logo (header, favicon, home-screen icon); saves a 512 px PNG. */
export default function LogoEditor() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0); // busts the <img> cache of the current logo
  const input = useRef<HTMLInputElement>(null);

  async function save(blob: Blob) {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", blob, "logo.png");
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

  return (
    <section className="card flex flex-col gap-4 p-4">
      <div>
        <h2 className="font-bold">โลโก้และไอคอน</h2>
        <p className="text-sm text-ink-3">ใช้ที่หัวเว็บ (แสดงเป็นวงกลม) ไอคอนแท็บเบราว์เซอร์ และไอคอนเมื่อเพิ่มลงหน้าจอมือถือ</p>
      </div>

      {img ? (
        <ImageCropper
          image={img}
          outW={512}
          outH={512}
          mime="image/png"
          round
          transparentOption
          previews={LOGO_PREVIEWS}
          saving={busy}
          onSave={save}
          onCancel={() => setImg(null)}
          onPickOther={() => input.current?.click()}
        />
      ) : (
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
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f)
            loadImage(f)
              .then((im) => {
                setError("");
                setImg(im);
              })
              .catch((err) => setError(err.message));
        }}
      />
      {status && <p className="text-sm text-emerald-400">{status}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
    </section>
  );
}
