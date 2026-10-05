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

  // A solid bar above the header: the first thing anyone sees, one short line.
  return (
    // Above the z-50 popups (welcome, search result), under full-screen views.
    <div role="note" className="relative z-[55] bg-warn text-plate">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1.5">
        <div className="min-w-0 flex-1 text-center">
          <span className="text-sm font-bold sm:text-base">⚠️ เว็บนี้ให้ใช้ฟรี ห้ามโอนเงินเด็ดขาด</span>{" "}
          <button
            type="button"
            className="text-xs font-semibold whitespace-nowrap underline underline-offset-2"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "ซ่อน" : "ดูรายละเอียด"}
          </button>
          {expanded && (
            <p className="mx-auto mt-1 max-w-3xl pb-1 text-xs leading-relaxed">
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
          className="shrink-0 self-start rounded px-1.5 text-sm font-bold opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
