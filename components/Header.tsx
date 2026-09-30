"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FOUND_PATH, REPORT_PATH } from "@/lib/urls";

const TABS = [
  { href: "/", label: "ค้นหาป้ายหาย", short: "ค้นหา" },
  { href: FOUND_PATH, label: "ป้ายที่พบ", short: "รายการ" },
  { href: REPORT_PATH, label: "แจ้งพบป้าย", short: "แจ้งพบ" },
];

export default function Header() {
  // Thai paths may arrive percent-encoded.
  const raw = usePathname();
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {}
  return (
    <header className="z-20 border-b border-line bg-surface text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          {/* Plain <img>: the logo can change on /admin, and the image optimizer would keep the old one for hours. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/branding/logo" alt="" width={40} height={40} className="h-10 w-10 rounded-full bg-white object-cover" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-lg font-bold tracking-tight">ตามหาป้ายทะเบียนหาย</div>
            <div className="truncate text-[11px] text-white/60">ป้ายทะเบียนหาย.com · Peoples LPR</div>
          </div>
        </Link>
        <nav className="ml-auto flex shrink-0 gap-1 rounded-xl bg-white/10 p-1">
          {TABS.map((t) => {
            const active =
              t.href === "/" ? path === "/" || /^\/(ค้นหา|จุดพบ)\//.test(path) : path.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
                  active ? "bg-brand text-white shadow" : "text-white/75 hover:text-white"
                }`}
              >
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
