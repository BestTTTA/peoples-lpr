"use client";
import Link from "next/link";
import { useEffect } from "react";
import { FOUND_PATH, REPORT_PATH, href } from "@/lib/urls";

/**
 * First thing on arrival: "what are you here for?", so nobody has to work out
 * from the page which part is for them. Search for my plate, or report plates
 * I found. ("ฝากตามหา" is reached from the search page after a no-result,
 * where the full form with name + phone + consent lives.)
 */
export default function WelcomeChooser({
  onSearch,
  onClose,
}: {
  onSearch: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="welcome-title" className="card flex w-full max-w-md flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="welcome-title" className="text-lg font-bold">
              ต้องการทำอะไร?
            </h2>
            <p className="text-sm text-ink-3">เลือกสิ่งที่ต้องการ ระบบจะพาไปขั้นตอนนั้นเลย</p>
          </div>
          <button type="button" className="icon-btn shrink-0" aria-label="ปิด" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <Choice icon="🔍" title="ค้นหาป้ายของฉัน" sub="ป้ายหาย ดูว่ามีคนเก็บได้แล้วหรือยัง" onClick={onSearch} primary />
          <Link
            href={href(REPORT_PATH)}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3 text-left transition hover:border-brand"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-2 text-2xl">📷</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">แจ้งพบป้าย</span>
              <span className="block text-sm text-ink-3">เก็บป้ายได้ ถ่ายรูปแจ้งให้เจ้าของมารับคืน</span>
            </span>
            <span aria-hidden className="text-ink-3">›</span>
          </Link>
          <Link href={href(FOUND_PATH)} className="self-center pt-1 text-sm text-ink-3 hover:text-ink">
            หรือดูรายการป้ายที่มีคนแจ้งพบทั้งหมด
          </Link>
        </div>
      </div>
    </div>
  );
}

function Choice({
  icon,
  title,
  sub,
  onClick,
  primary,
}: {
  icon: string;
  title: string;
  sub: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:border-brand ${
        primary ? "border-brand/60 bg-brand/10" : "border-line bg-surface-2/60"
      }`}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface-2 text-2xl">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-ink-3">{sub}</span>
      </span>
      <span aria-hidden className="text-ink-3">›</span>
    </button>
  );
}
