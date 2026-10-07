"use client";
import { useEffect, useState } from "react";
import ChannelIcon from "@/components/ChannelIcon";
import ContactChannels from "@/components/ContactChannels";
import {
  CHANNEL_TYPES,
  type Channel,
  type ChannelType,
  type ContactInfo,
  MAX_CHANNELS,
  channelDisplay,
  channelHref,
} from "@/lib/contact";

/** Admin: the site's contact channels, shown on every page under "ติดต่อเรา". */
export default function ContactSettings() {
  const [saved, setSaved] = useState<ContactInfo | null>(null);
  const [draft, setDraft] = useState<ContactInfo | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/contact")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setSaved(d);
        setDraft(d);
      })
      .catch((e) => setError(e.message || "โหลดไม่สำเร็จ"));
  }, []);

  if (!draft) return <section className="card p-4 text-sm text-ink-3">{error || "กำลังโหลด…"}</section>;

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const setChannel = (i: number, patch: Partial<Channel>) =>
    setDraft({ ...draft, channels: draft.channels.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const move = (i: number, d: -1 | 1) => {
    const list = [...draft.channels];
    [list[i], list[i + d]] = [list[i + d], list[i]];
    setDraft({ ...draft, channels: list });
  };

  async function save() {
    setError("");
    const res = await fetch("/api/admin/contact", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok) return setError(data?.error ?? "บันทึกไม่สำเร็จ");
    setSaved(data);
    setDraft(data);
    setStatus("บันทึกแล้ว — แสดงบนเว็บภายใน ~1 นาที");
    setTimeout(() => setStatus(""), 3000);
  }

  return (
    <section className="card flex flex-col gap-3 p-4">
      <div>
        <h2 className="font-bold">ช่องทางการติดต่อ</h2>
        <p className="text-sm text-ink-3">
          แสดงท้ายทุกหน้า (เหนือเครดิต) และในเมนู “ติดต่อผู้ดูแล” เมื่อกรอกรหัสจัดการผิดครบ 3 ครั้ง · ไม่มีช่องทางก็จะไม่แสดง
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-sm font-medium">
          หัวข้อ
          <input
            className="field mt-1"
            maxLength={60}
            value={draft.heading}
            onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
          />
        </label>
        <label className="text-sm font-medium">
          ข้อความสั้น ๆ <span className="font-normal text-ink-3">(ไม่บังคับ)</span>
          <input
            className="field mt-1"
            maxLength={300}
            placeholder="เช่น แจ้งปัญหาการใช้งาน หรือสอบถามการรับป้ายคืน"
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </label>
      </div>

      <ul className="flex flex-col gap-2">
        {draft.channels.map((c, i) => {
          const href = channelHref(c);
          return (
            <li key={i} className="flex flex-col gap-2 rounded-xl border border-line p-2 md:flex-row md:items-center">
              <span className="hidden md:block">
                <ChannelIcon type={c.type} size={32} />
              </span>
              <select
                className="field md:w-36"
                value={c.type}
                onChange={(e) => setChannel(i, { type: e.target.value as ChannelType })}
              >
                {Object.entries(CHANNEL_TYPES).map(([k, t]) => (
                  <option key={k} value={k}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                className="field md:w-44"
                maxLength={60}
                placeholder={`ชื่อที่แสดง (${CHANNEL_TYPES[c.type].label})`}
                value={c.label}
                onChange={(e) => setChannel(i, { label: e.target.value })}
              />
              <div className="min-w-0 flex-1">
                <input
                  className="field"
                  maxLength={200}
                  placeholder={CHANNEL_TYPES[c.type].placeholder}
                  value={c.value}
                  onChange={(e) => setChannel(i, { value: e.target.value })}
                />
                <p className={`mt-0.5 truncate text-xs ${c.value && !href && c.type !== "other" ? "text-warn" : "text-ink-3"}`}>
                  {c.value
                    ? href
                      ? `แสดงเป็น “${channelDisplay(c)}” · ลิงก์ไป ${href}`
                      : c.type === "other"
                        ? "แสดงเป็นข้อความ (ไม่มีลิงก์)"
                        : "รูปแบบไม่ถูกต้อง — จะแสดงเป็นข้อความเฉย ๆ"
                    : " "}
                </p>
              </div>
              <div className="flex gap-1 self-end md:self-center">
                <button type="button" className="icon-btn" aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="เลื่อนลง"
                  disabled={i === draft.channels.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="icon-btn text-red-400"
                  aria-label="ลบ"
                  onClick={() => setDraft({ ...draft, channels: draft.channels.filter((_, j) => j !== i) })}
                >
                  ✕
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-ghost"
          disabled={draft.channels.length >= MAX_CHANNELS}
          onClick={() => setDraft({ ...draft, channels: [...draft.channels, { type: "line", label: "", value: "" }] })}
        >
          + เพิ่มช่องทาง
        </button>
        <button type="button" className="btn-primary" disabled={!dirty} onClick={save}>
          บันทึก
        </button>
        {dirty && (
          <button type="button" className="btn-ghost" onClick={() => setDraft(saved)}>
            ยกเลิก
          </button>
        )}
        <span className="text-sm text-emerald-400">{status}</span>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>

      {draft.channels.some((c) => c.value) && (
        <div className="rounded-xl border border-dashed border-line p-3">
          <p className="mb-2 text-xs text-ink-3">ตัวอย่างที่ผู้ใช้จะเห็น</p>
          <ContactChannels preview={{ ...draft, channels: draft.channels.filter((c) => c.value.trim()) }} />
        </div>
      )}
    </section>
  );
}
