"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { FOUND_PATH, REPLACEMENT_GUIDE_PATH, REPORT_PATH } from "@/lib/urls";

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
);

const TABS = [
  {
    href: "/",
    label: "ป้ายของฉันหาย",
    short: "ป้ายหาย",
    icon: icon(
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>,
    ),
  },
  {
    href: FOUND_PATH,
    label: "รายการป้ายที่พบ",
    short: "รายการ",
    icon: icon(<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />),
  },
  {
    href: REPORT_PATH,
    label: "ฉันเก็บป้ายได้",
    short: "แจ้งพบ",
    icon: icon(
      <>
        <path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4z" />
        <circle cx="12" cy="13" r="3.2" />
      </>,
    ),
  },
  {
    href: REPLACEMENT_GUIDE_PATH,
    label: "วิธีขอป้ายทะเบียนใหม่",
    short: "ขอป้ายใหม่",
    icon: icon(
      <>
        <path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v13H7.5A2.5 2.5 0 0 1 5 17.5z" />
        <path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H18M9 8h5M9 11h5" />
      </>,
    ),
  },
];

export default function Header() {
  // Thai paths may arrive percent-encoded.
  const raw = usePathname();
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {}
  return (
    <header className="z-20 border-b border-white/10 bg-brand text-white">
      <div className="mx-auto flex max-w-[1216px] flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4 lg:flex-nowrap lg:gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          {/* Plain <img>: the logo can change on /admin, and the image optimizer would keep the old one for hours. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/branding/logo" alt="" width={44} height={44} className="h-11 w-11 rounded-full bg-white object-cover ring-2 ring-white/40" />
          <div className="hidden min-w-0 leading-tight sm:block">
            <div className="truncate text-lg font-bold tracking-tight">ตามหาป้ายทะเบียนหาย</div>
            <div className="truncate text-[11px] text-white/70">ป้ายทะเบียนหาย.com · Peoples LPR</div>
          </div>
        </Link>
        <nav aria-label="เมนูหลัก" className="order-2 grid w-full grid-cols-4 gap-1 rounded-xl bg-white/15 p-1 lg:order-none lg:ml-auto lg:flex lg:w-auto lg:shrink-0">
          {TABS.map((t) => {
            const active =
              t.href === "/" ? path === "/" || /^\/(ค้นหา|จุดพบ)\//.test(path) : path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-w-0 items-center justify-center gap-1 rounded-lg px-1.5 py-2 text-[11px] font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:gap-1.5 lg:px-3 lg:text-sm ${
                  active ? "bg-white text-brand shadow-sm" : "text-white/80 hover:text-white"
                }`}
              >
                {t.icon}
                <span className="lg:hidden">{t.short}</span>
                <span className="hidden lg:inline">{t.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
