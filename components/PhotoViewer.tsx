"use client";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Full-size photo over the page. It used to open in a new tab, which on phones
 * (and in LINE / Facebook in-app browsers) left people on a bare image with no
 * way back. The viewer adds a history entry, so the phone's Back button closes
 * it instead of leaving the page.
 */
export default function PhotoViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Every way of closing goes through Back, so our history entry never lingers.
  const close = () => (history.state?.photoViewer ? history.back() : onClose());

  useEffect(() => {
    // Once only (effects can run twice in development).
    if (!history.state?.photoViewer) history.pushState({ ...history.state, photoViewer: true }, "");
    const onPop = () => closeRef.current();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // not the popup underneath
        if (history.state?.photoViewer) history.back();
        else closeRef.current();
      }
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[70] flex flex-col bg-black"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="flex items-center justify-between gap-2 p-2">
        <a href={src} download className="btn-ghost px-3 py-1.5 text-sm text-white" onClick={(e) => e.stopPropagation()}>
          บันทึกรูป
        </a>
        <button type="button" className="btn-ghost px-4 py-1.5 text-sm text-white" onClick={close} autoFocus>
          ✕ ปิด
        </button>
      </div>
      {/* Scrollable so a pinch-zoomed or large photo can be panned. */}
      <div className="min-h-0 flex-1 overflow-auto">
        {/* m-auto in a min-h-full flex box centres the photo, yet a zoomed one still scrolls from its top. */}
        <div className="flex min-h-full" onClick={(e) => e.target === e.currentTarget && close()}>
          {/* eslint-disable-next-line @next/next/no-img-element -- user uploads served from our API */}
          <img src={src} alt={alt} className="m-auto block max-h-[calc(100dvh-56px)] max-w-full object-contain" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
