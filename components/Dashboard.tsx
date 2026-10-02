"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DevCredit from "@/components/DevCredit";
import PlateBadge from "@/components/PlateBadge";
import ProvinceInput from "@/components/ProvinceInput";
import { timeAgo } from "@/components/ReportCard";
import { clean } from "@/lib/plate";
import { RECENCY, recencyOf } from "@/lib/recency";
import { toSpots } from "@/lib/spots";
import type { PublicReport } from "@/lib/types";
import { href, reportPath, searchPath } from "@/lib/urls";

type Sort = "new" | "most";

/** Plates shown per point before "แสดงทั้งหมด". */
const PREVIEW = 30;

/** Every reported plate as text, grouped by where it was found. */
export default function Dashboard() {
  const [reports, setReports] = useState<PublicReport[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then(setReports)
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้า"));
  }, []);

  // By spot: reports sent from the same place are one card, as on the map.
  const all = useMemo(() => toSpots(reports ?? []), [reports]);

  const stats = useMemo(() => {
    const plates = all.flatMap((r) => r.plates);
    const byProvince = new Map<string, number>();
    for (const p of plates) byProvince.set(p.province, (byProvince.get(p.province) ?? 0) + 1);
    const known = [...byProvince.keys()].filter(Boolean).length;
    return {
      plates: plates.length,
      points: all.length,
      provinces: known,
      // Per report: a spot can mix old and new reports.
      fresh: (reports ?? [])
        .filter((r) => recencyOf(r.createdAt) === "new")
        .reduce((s, r) => s + r.plates.length, 0),
      top: [...byProvince.entries()].filter(([name]) => name).sort((a, b) => b[1] - a[1]).slice(0, 8),
    };
  }, [all, reports]);

  // Each point keeps only the plates that match; points with none drop out.
  const groups = useMemo(() => {
    const q = clean(query);
    const hits = all
      .map((r) => ({
        report: r,
        plates: r.plates.filter(
          (p) => (!province || p.province === province) && (!q || `${p.prefix}${p.number}${p.province}`.includes(q)),
        ),
      }))
      .filter((g) => g.plates.length > 0);
    return hits.sort((a, b) =>
      sort === "most"
        ? b.plates.length - a.plates.length
        : b.report.createdAt.localeCompare(a.report.createdAt),
    );
  }, [all, query, province, sort]);

  const shown = groups.reduce((s, g) => s + g.plates.length, 0);
  const filtering = query !== "" || province !== "";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-bold">ป้ายทะเบียนที่แจ้งพบ</h1>
        <p className="text-sm text-ink-3">
          ทุกป้ายที่มีผู้แจ้งพบ แยกตามจุดที่พบ · แตะป้ายเพื่อดูจุดรับคืนและช่องทางสำหรับติดต่อติดต่อ
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="ป้ายที่แจ้งพบ" value={stats.plates} accent="text-brand" />
        <Stat label="จุดที่พบ" value={stats.points} />
        <Stat label="จังหวัด" value={stats.provinces} />
        <Stat label="แจ้งใหม่ ≤ 3 วัน" value={stats.fresh} accent="text-[#2fd08b]" />
      </div>

      {stats.top.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-bold">จังหวัดบนป้ายที่พบมากที่สุด</h2>
          <ul className="flex flex-col gap-2">
            {stats.top.map(([name, n]) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => setProvince(province === name ? "" : name)}
                  className={`grid w-full grid-cols-[8.5rem_1fr_2.5rem] items-center gap-2 text-left text-sm ${
                    province === name ? "text-brand" : ""
                  }`}
                >
                  <span className="truncate">{name}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${(n / stats.top[0][1]) * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{n}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="card flex flex-col gap-2 p-3 md:flex-row md:items-center">
        <input
          className="field md:flex-1"
          type="search"
          placeholder="พิมพ์หมวดอักษรหรือเลข เช่น 3ฒน, 5702"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ProvinceInput className="md:w-64" value={province} onChange={setProvince} emptyLabel="ทุกจังหวัด" />
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 text-sm">
          {(
            [
              ["new", "ล่าสุด"],
              ["most", "ป้ายมากสุด"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setSort(k)}
              className={`rounded-lg px-3 py-1.5 whitespace-nowrap ${sort === k ? "bg-brand text-white" : "text-ink-3"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-ink-3">
        {reports === null
          ? "กำลังโหลด…"
          : filtering
            ? `พบ ${shown} ป้าย จาก ${groups.length} จุด`
            : `ทั้งหมด ${shown} ป้าย จาก ${groups.length} จุด`}
        {filtering && (
          <button
            type="button"
            className="ml-2 text-brand"
            onClick={() => {
              setQuery("");
              setProvince("");
            }}
          >
            ล้างตัวกรอง
          </button>
        )}
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid items-start gap-3 md:grid-cols-2">
        {groups.map(({ report, plates }) => {
          const recency = RECENCY[recencyOf(report.createdAt)];
          const times = report.reportIds.length;
          const open = expanded.has(report.id);
          const visible = open ? plates : plates.slice(0, PREVIEW);
          return (
            <article key={report.id} className="card flex flex-col gap-3 p-4">
              <header className="flex items-start gap-3">
                <span
                  className="mt-1.5 h-3 w-3 shrink-0 rounded-full ring-2 ring-white/80"
                  style={{ background: recency.color }}
                  title={recency.label}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 font-semibold">
                    {report.place || `${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}`}
                  </h3>
                  <p className="text-xs text-ink-3">
                    {times > 1 ? `แจ้ง ${times} ครั้ง · ล่าสุด ` : "แจ้งพบ "}
                    {timeAgo(report.createdAt)} ·{" "}
                    {plates.length === report.plates.length
                      ? `${plates.length} ป้าย`
                      : `ตรง ${plates.length} จาก ${report.plates.length} ป้าย`}
                  </p>
                </div>
              </header>

              <ul className="flex flex-wrap gap-2">
                {visible.map((p, i) => (
                  <li key={`${p.prefix}${p.number}${p.province}${i}`}>
                    <Link
                      href={href(searchPath(p.prefix, p.number, p.province))}
                      title="ดูจุดรับคืนและช่องทางติดต่อ"
                      className="block rounded-md transition hover:-translate-y-0.5 hover:ring-2 hover:ring-brand"
                    >
                      <PlateBadge prefix={p.prefix} number={p.number} province={p.province} size="sm" />
                    </Link>
                  </li>
                ))}
              </ul>
              {plates.length > PREVIEW && (
                <button
                  type="button"
                  className="self-start text-sm text-brand"
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (open) next.delete(report.id);
                      else next.add(report.id);
                      return next;
                    })
                  }
                >
                  {open ? "ย่อ" : `แสดงทั้งหมด (${plates.length} ป้าย)`}
                </button>
              )}

              <footer className="mt-auto flex flex-wrap gap-2">
                <Link href={href(reportPath(report.id))} className="btn-ghost px-3 py-1.5 text-sm">
                  📍 ดูบนแผนที่
                </Link>
                <a
                  className="btn-ghost px-3 py-1.5 text-sm"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${report.lat},${report.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  นำทาง
                </a>
              </footer>
            </article>
          );
        })}
      </div>

      {reports !== null && groups.length === 0 && (
        <p className="card p-4 text-sm text-ink-3">
          {filtering ? "ไม่พบป้ายที่ตรงกับตัวกรอง" : "ยังไม่มีผู้แจ้งพบป้าย"}
        </p>
      )}

      <DevCredit className="pt-4" />
    </div>
  );
}

function Stat({ label, value, accent = "" }: { label: string; value: number; accent?: string }) {
  return (
    <div className="card p-4">
      <div className={`text-3xl font-bold tabular-nums ${accent}`}>{value.toLocaleString("th-TH")}</div>
      <div className="text-sm text-ink-3">{label}</div>
    </div>
  );
}
