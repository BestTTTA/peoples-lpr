"use client";
import { useEffect, useRef, useState } from "react";
import ImageCropper, { loadImage } from "@/components/admin/ImageCropper";

type Og = { ogTitle: string; ogDescription: string; ogAlt: string; ogVersion: string; ogImage: string | null };
type Texts = Pick<Og, "ogTitle" | "ogDescription" | "ogAlt">;

const OG_PREVIEWS = [{ label: "ขนาดในการ์ดแชร์", w: 240, h: 126 }];

/** Admin: the link-share preview (Open Graph): 1200x630 image, title, description. */
export default function OgEditor() {
  const [og, setOg] = useState<Og | null>(null);
  const [defaults, setDefaults] = useState<Texts | null>(null);
  const [draft, setDraft] = useState<Texts | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/branding/og")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setOg(d);
        setDefaults(d.defaults);
        setDraft({ ogTitle: d.ogTitle, ogDescription: d.ogDescription, ogAlt: d.ogAlt });
      })
      .catch((e) => setError(e.message || "โหลดไม่สำเร็จ"));
  }, []);

  function done(d: Og, msg: string) {
    setOg(d);
    setError("");
    setStatus(`${msg} — ลิงก์ที่แชร์ใหม่จะใช้ค่านี้ (โพสต์ Facebook ที่แชร์ไปแล้ว ให้กด Scrape Again ใน Sharing Debugger)`);
  }

  async function call(method: string, body?: BodyInit, json = false): Promise<Og | null> {
    setBusy(true);
    const res = await fetch("/api/admin/branding/og", {
      method,
      body,
      headers: json ? { "Content-Type": "application/json" } : undefined,
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) {
      setError(data?.error ?? "บันทึกไม่สำเร็จ");
      return null;
    }
    return data as Og;
  }

  async function saveImage(blob: Blob) {
    const form = new FormData();
    form.append("file", blob, "og.jpg");
    const d = await call("POST", form);
    if (d) {
      setImg(null);
      done(d, "บันทึกรูปแชร์แล้ว");
    }
  }

  async function saveText() {
    const d = await call("PUT", JSON.stringify(draft), true);
    if (d) {
      done(d, "บันทึกข้อความแล้ว");
      setDraft({ ogTitle: d.ogTitle, ogDescription: d.ogDescription, ogAlt: d.ogAlt });
    }
  }

  async function resetImage() {
    if (!confirm("กลับไปใช้รูปแชร์เริ่มต้น?")) return;
    const d = await call("DELETE");
    if (d) done(d, "กลับไปใช้รูปเริ่มต้นแล้ว");
  }

  if (!og || !draft) return <section className="card p-4 text-sm text-ink-3">{error || "กำลังโหลด…"}</section>;
  const dirty = draft.ogTitle !== og.ogTitle || draft.ogDescription !== og.ogDescription || draft.ogAlt !== og.ogAlt;

  return (
    <section className="card flex flex-col gap-4 p-4">
      <div>
        <h2 className="font-bold">ภาพและข้อความตอนแชร์ลิงก์ (Open Graph)</h2>
        <p className="text-sm text-ink-3">แสดงเมื่อแชร์ลิงก์เว็บใน Facebook, LINE, X ฯลฯ · รูปขนาด 1200×630</p>
      </div>

      {img ? (
        <ImageCropper
          image={img}
          outW={1200}
          outH={630}
          mime="image/jpeg"
          quality={0.88}
          previews={OG_PREVIEWS}
          saving={busy}
          onSave={saveImage}
          onCancel={() => setImg(null)}
          onPickOther={() => input.current?.click()}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
          {/* How a share looks: image on top, then domain, title, description. */}
          <div className="self-start overflow-hidden rounded-xl border border-line bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- the live share image */}
            <img
              src={`/api/branding/og?v=${og.ogVersion}`}
              alt={og.ogAlt}
              className="aspect-[1200/630] w-full bg-black object-cover"
            />
            <div className="flex flex-col gap-0.5 p-3">
              <span className="text-xs text-ink-3">ป้ายทะเบียนหาย.com</span>
              <span className="line-clamp-2 font-semibold">{draft.ogTitle || defaults?.ogTitle}</span>
              <span className="line-clamp-2 text-sm text-ink-3">{draft.ogDescription || defaults?.ogDescription}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" onClick={() => input.current?.click()}>
                อัปโหลดรูปแชร์ใหม่
              </button>
              {og.ogImage && (
                <button type="button" className="btn-ghost" disabled={busy} onClick={resetImage}>
                  ใช้รูปเริ่มต้น
                </button>
              )}
            </div>
            <label className="font-medium">
              หัวข้อ <span className="font-normal text-ink-3">({draft.ogTitle.length}/120)</span>
              <input
                className="field mt-1"
                maxLength={120}
                placeholder={defaults?.ogTitle}
                value={draft.ogTitle}
                onChange={(e) => setDraft({ ...draft, ogTitle: e.target.value })}
              />
            </label>
            <label className="font-medium">
              คำอธิบาย <span className="font-normal text-ink-3">({draft.ogDescription.length}/300)</span>
              <textarea
                className="field mt-1 min-h-20"
                maxLength={300}
                placeholder={defaults?.ogDescription}
                value={draft.ogDescription}
                onChange={(e) => setDraft({ ...draft, ogDescription: e.target.value })}
              />
            </label>
            <label className="font-medium">
              คำอธิบายรูป (alt) <span className="font-normal text-ink-3">สำหรับโปรแกรมอ่านหน้าจอ</span>
              <input
                className="field mt-1"
                maxLength={300}
                placeholder={defaults?.ogAlt}
                value={draft.ogAlt}
                onChange={(e) => setDraft({ ...draft, ogAlt: e.target.value })}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={!dirty || busy} onClick={saveText}>
                บันทึกข้อความ
              </button>
              <button type="button" className="btn-ghost" onClick={() => setDraft({ ogTitle: "", ogDescription: "", ogAlt: "" })}>
                ใช้ข้อความเริ่มต้น
              </button>
            </div>
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
