"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState } from "react";
import { useLanguage, type Locale } from "@/components/LanguageProvider";
import englishIcon from "@/image_ref/en icon.png";
import thaiIcon from "@/image_ref/th icon.png";

const OPTIONS: Array<{ locale: Locale; icon: StaticImageData; label: string; short: string }> = [
  { locale: "th", icon: thaiIcon, label: "ภาษาไทย", short: "TH" },
  { locale: "en", icon: englishIcon, label: "English", short: "EN" },
];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const active = OPTIONS.find((option) => option.locale === locale) ?? OPTIONS[0];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return (
    <div ref={root} data-no-translate className="relative ml-auto shrink-0 lg:ml-0">
      <button
        type="button"
        className="flex h-9 items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-2 text-xs font-semibold text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        aria-label={locale === "th" ? "เปลี่ยนภาษา" : "Change language"}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Image src={active.icon} alt="" className="h-5 w-7 rounded-sm object-cover ring-1 ring-white/30" aria-hidden />
        <span>{active.short}</span>
        <span className="text-[10px] text-white/70" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-36 overflow-hidden rounded-xl border border-line bg-white p-1.5 text-ink shadow-xl" role="menu">
          {OPTIONS.map((option) => (
            <button
              key={option.locale}
              type="button"
              role="menuitemradio"
              aria-checked={locale === option.locale}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-surface-2 ${locale === option.locale ? "bg-brand/10 font-semibold text-brand" : ""}`}
              onClick={() => {
                setLocale(option.locale);
                setOpen(false);
              }}
            >
              <Image src={option.icon} alt="" className="h-5 w-7 rounded-sm object-cover ring-1 ring-black/10" aria-hidden />
              <span className="flex-1">{option.label}</span>
              {locale === option.locale && <span aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
