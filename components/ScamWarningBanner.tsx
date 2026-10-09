"use client";
import { useState, useSyncExternalStore } from "react";

/**
 * Site-wide warning that this is a free coordination service and payments
 * mean a scam. Dismissed per-browser; the dismissal doesn't sync anywhere so
 * each device shows it until acknowledged.
 */
const DISMISS_KEY = "peoples-lpr:scam-banner-dismissed";
const EVENT = "peoples-lpr:scam-banner-dismissed";

function readDismissed(): string {
  try {
    return localStorage.getItem(DISMISS_KEY) ?? "";
  } catch {
    return "";
  }
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export default function ScamWarningBanner() {
  // Shown in the server HTML so it is there on first paint (the page doesn't
  // jump when it arrives); a browser that dismissed it hides it on hydration.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => "");
  const [expanded, setExpanded] = useState(false);

  if (dismissed === "1") return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
      window.dispatchEvent(new Event(EVENT));
    } catch {}
  }

  // A slim amber-tinted bar above the header: seen first, without shouting over the page.
  return (
    // Above the z-50 popups (welcome, search result), under full-screen views.
    <div
      role="note"
      className="relative z-[55] border-b border-warn/20 bg-[#fdf6e3] text-ink"
    >
      <div className="mx-auto flex max-w-[1216px] items-center gap-2.5 px-4 py-1.5">
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-warn/20 text-[11px] text-warn ring-1 ring-warn/40">
              !
            </span>
            <span className="text-[13px] leading-snug sm:text-sm">
              <b className="font-semibold text-warn">เว็บนี้ให้ใช้ฟรี</b>
              <span className="text-ink-3"> · </span>
              ห้ามโอนเงินเด็ดขาด
            </span>
            <button
              type="button"
              className="rounded-full border border-warn/30 bg-white/60 px-2 py-0.5 text-[11px] text-ink-3 transition hover:border-warn/60 hover:text-ink"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "ซ่อน" : "ดูรายละเอียด"}
            </button>
          </div>
          {expanded && (
            <p className="mt-1.5 max-w-3xl pb-1 text-center text-xs leading-relaxed text-ink-3">
              เว็บไซต์นี้เป็นเพียงสื่อกลางในการประสานงาน และตามหาป้ายทะเบียนรถยนต์/รถจักรยานยนต์ที่หลุดหายให้บริการฟรีต่อสาธารณะ
              โดยจะไม่มีการเรียกร้องขอรับผลตอบแทนใด ๆ ทั้งสิ้น
              <br />
              โปรดระวังมิจฉาชีพที่อ้างว่าเก็บป้ายของคุณไว้ แล้วขอค่าส่ง ค่ามัดจำ หรือค่าตอบแทน
              <br />
              ถ้าเป็นไปได้ ให้เดินทางไปรับป้ายด้วยตนเอง และพกเล่มทะเบียนหรือบัตรประชาชนไปเพื่อยืนยันความเป็นเจ้าของ
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="ปิดคำเตือน"
          className="shrink-0 self-start rounded-full px-1.5 text-sm text-ink-3 transition hover:text-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
