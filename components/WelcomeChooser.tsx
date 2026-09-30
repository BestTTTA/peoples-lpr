"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import PlateBadge from "@/components/PlateBadge";
import ProvinceInput from "@/components/ProvinceInput";
import { clean, isValidNumber, isValidPrefix } from "@/lib/plate";
import { FOUND_PATH, type PlateQuery, REPORT_PATH, href } from "@/lib/urls";

/**
 * First thing on arrival: "what are you here for?", so nobody has to work out
 * from the page which part is for them. Search for my plate, have the site
 * keep looking (watch), or report plates I found.
 */
export default function WelcomeChooser({
  onSearch,
  onWatch,
  onClose,
}: {
  onSearch: () => void;
  onWatch: (q: PlateQuery) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"choose" | "watch">("choose");
  const [prefix, setPrefix] = useState("");
  const [number, setNumber] = useState("");
  const [province, setProvince] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ok = isValidPrefix(prefix) && isValidNumber(number);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="welcome-title" className="card flex w-full max-w-md flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="welcome-title" className="text-lg font-bold">
              {step === "choose" ? "ต้องการทำอะไร?" : "ฝากตามหาป้าย"}
            </h2>
            <p className="text-sm text-ink-3">
              {step === "choose"
                ? "เลือกสิ่งที่ต้องการ ระบบจะพาไปขั้นตอนนั้นเลย"
                : "ใส่ป้ายที่หาย ระบบจะค้นให้ทันที ถ้ายังไม่มีคนแจ้งพบ จะเตือนเมื่อคุณกลับมาเปิดเว็บนี้"}
            </p>
          </div>
          <button type="button" className="icon-btn shrink-0" aria-label="ปิด" onClick={onClose}>
            ✕
          </button>
        </div>

        {step === "choose" ? (
          <div className="flex flex-col gap-2">
            <Choice icon="🔍" title="ค้นหาป้ายของฉัน" sub="ป้ายหาย ดูว่ามีคนเก็บได้แล้วหรือยัง" onClick={onSearch} primary />
            <Choice icon="🔔" title="ฝากตามหาป้าย" sub="ยังไม่เจอ ให้ระบบเตือนเมื่อมีคนแจ้งพบ" onClick={() => setStep("watch")} />
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
        ) : (
          <form
            className="flex flex-col gap-3"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setTouched(true);
              if (ok) onWatch({ prefix: clean(prefix), number: clean(number), province });
            }}
          >
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm font-medium">
                หมวดอักษร
                <input
                  className="field mt-1"
                  placeholder="เช่น 3ฒน"
                  maxLength={5}
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  autoFocus
                />
              </label>
              <label className="text-sm font-medium">
                เลขทะเบียน
                <input
                  className="field mt-1"
                  placeholder="เช่น 5702"
                  inputMode="numeric"
                  maxLength={4}
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
                />
              </label>
            </div>
            <label className="text-sm font-medium">
              จังหวัด <span className="font-normal text-ink-3">(ไม่บังคับ)</span>
              <ProvinceInput className="mt-1" value={province} onChange={setProvince} emptyLabel="ไม่ทราบ / ทุกจังหวัด" />
            </label>
            {touched && !ok && <p className="text-xs text-warn">ใส่หมวดอักษร (เช่น กข, 1กข) และเลขทะเบียน 1–4 หลัก</p>}
            <div className="flex items-center gap-3">
              <PlateBadge prefix={clean(prefix)} number={number} province={province} size="sm" emptyProvince="ทุกจังหวัด" />
              <button type="submit" className="btn-primary ml-auto">
                ค้นหาและฝากตามหา
              </button>
            </div>
            <button type="button" className="self-start text-sm text-ink-3 hover:text-ink" onClick={() => setStep("choose")}>
              ← กลับ
            </button>
          </form>
        )}
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
