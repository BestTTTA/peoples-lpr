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
  // "" during SSR and first paint, then whatever localStorage holds. Avoids a
  // flash: on the first client paint we don't know yet, so we keep it hidden,
  // and on the next tick it comes in correctly.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => "pending");
  const [expanded, setExpanded] = useState(false);

  if (dismissed === "pending" || dismissed === "1") return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
      window.dispatchEvent(new Event(EVENT));
    } catch {}
  }

  return (
    <div className="z-30 border-b border-warn/40 bg-warn/15 text-ink">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-snug font-bold text-warn sm:text-base">
            ⚠️ เว็บไซต์นี้ให้ใช้ฟรี ห้ามโอนเงิน และโปรดระวังมิจฉาชีพ
          </div>
          {expanded ? (
            <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
              เว็บไซต์นี้เป็นเพียงสื่อกลางในการประสานงาน และตามหาป้ายทะเบียนรถยนต์/รถจักรยานยนต์ที่หลุดหายให้บริการฟรีต่อสาธารณะ
              โดยจะไม่มีการเรียกร้องขอรับผลตอบแทนใด ๆ ทั้งสิ้น
              <br />
              โปรดระวังมิจฉาชีพที่อ้างว่าเก็บป้ายของคุณไว้ แล้วขอค่าส่ง ค่ามัดจำ หรือค่าตอบแทน
              <br />
              ถ้าเป็นไปได้ ให้เดินทางไปรับป้ายด้วยตนเอง และพกเล่มทะเบียนหรือบัตรประชาชนไปเพื่อยืนยันความเป็นเจ้าของ
            </p>
          ) : (
            <button
              type="button"
              className="mt-0.5 text-xs text-ink-3 underline hover:text-ink"
              onClick={() => setExpanded(true)}
            >
              ดูรายละเอียด
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="ปิดคำเตือน"
          className="icon-btn shrink-0 text-ink-3 hover:text-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
