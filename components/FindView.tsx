"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import DevCredit from "@/components/DevCredit";
import FoundMap, { type Focus } from "@/components/FoundMap";
import PlateBadge from "@/components/PlateBadge";
import ProvinceInput from "@/components/ProvinceInput";
import ReportCard, { RecencyBadge, timeAgo } from "@/components/ReportCard";
import SearchHint from "@/components/SearchHint";
import { clean, isValidNumber, isValidPrefix } from "@/lib/plate";
import { RECENCY } from "@/lib/recency";
import type { PublicReport, SearchHit } from "@/lib/types";

type Results = { exact: SearchHit[]; near: SearchHit[] };

const LIST_LIMIT = 100;

function FunnelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M3 4.5h18l-7 8.2v6.3l-4 1.5v-7.8z" />
    </svg>
  );
}

export default function FindView({ initialFocus }: { initialFocus: Focus | null }) {
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterProvince, setFilterProvince] = useState("");
  const [prefix, setPrefix] = useState("");
  const [number, setNumber] = useState("");
  const [province, setProvince] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((data: PublicReport[]) => {
        setReports(data);
        // Coming back from a new report: show it once the data is in.
        if (initialFocus) {
          setFocus(initialFocus);
          setSelected(initialFocus.reportIds[0] ?? null);
        }
      })
      .catch(() => setError("โหลดข้อมูลแผนที่ไม่สำเร็จ"));
  }, [initialFocus]);

  const visible = useMemo(
    () =>
      (filterProvince ? reports.filter((r) => r.plates.some((p) => p.province === filterProvince)) : reports)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reports, filterProvince],
  );

  const prefixOk = isValidPrefix(prefix);
  const numberOk = isValidNumber(number);
  const provinceOk = province !== "";
  const plateTotal = reports.reduce((s, r) => s + r.plates.length, 0);

  function select(id: string, scroll = false) {
    const r = reports.find((x) => x.id === id);
    if (!r) return;
    setSelected(id);
    setFocus({ lat: r.lat, lng: r.lng, reportIds: [id] });
    if (scroll) {
      setPanelOpen(true);
      requestAnimationFrame(() => cardRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!prefixOk || !numberOk || !provinceOk) return;
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ prefix: clean(prefix), number: clean(number), province });
      const res = await fetch(`/api/search?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data);
      const hits = data.exact as SearchHit[];
      if (hits[0]) {
        setSelected(hits[0].report.id);
        setFocus({ lat: hits[0].report.lat, lng: hits[0].report.lng, reportIds: hits.map((h) => h.report.id) });
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "ค้นหาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  const showHit = (h: SearchHit) => {
    setSelected(h.report.id);
    setFocus({ lat: h.report.lat, lng: h.report.lng, reportIds: [h.report.id] });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto md:block md:overflow-hidden">
      <div className="relative h-[48vh] shrink-0 md:absolute md:inset-0 md:h-auto">
        <FoundMap reports={visible} focus={focus} onSelect={(id) => select(id, true)} />
      </div>

      {!panelOpen && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="btn absolute top-4 right-4 z-10 hidden border border-line bg-surface text-ink md:inline-flex"
        >
          ☰ รายการป้ายที่พบ
        </button>
      )}

      {panelOpen && (
        <>
          <button
            type="button"
            aria-label="ซ่อนรายการ"
            onClick={() => setPanelOpen(false)}
            className="absolute top-4 right-[412px] z-10 hidden h-9 w-9 place-items-center rounded-full border border-line bg-surface text-lg text-ink md:grid"
          >
            ×
          </button>
          <aside className="dark-scroll relative z-10 flex flex-col gap-3 [&>*]:shrink-0 border-t border-line bg-surface p-4 md:absolute md:top-4 md:right-4 md:bottom-4 md:w-[380px] md:overflow-y-auto md:rounded-3xl md:border">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold">ตามหาป้ายทะเบียน</h1>
                <p className="text-sm text-ink-3">
                  พบแล้ว <b className="text-ink">{plateTotal.toLocaleString("th-TH")}</b> ป้าย ·{" "}
                  {reports.length.toLocaleString("th-TH")} จุด
                </p>
              </div>
              <button
                type="button"
                aria-label="กรองตามจังหวัด"
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen((v) => !v)}
                className={`icon-btn relative ${filterOpen || filterProvince ? "bg-surface-2 text-ink" : ""}`}
              >
                <FunnelIcon />
                {filterProvince && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-brand" />}
              </button>
            </div>

            {filterOpen && (
              <div className="rounded-xl border border-line bg-surface-2/60 p-3">
                <div className="mb-1.5 text-sm font-medium">กรองจุดตามจังหวัดของป้าย</div>
                <div className="flex gap-2">
                  <ProvinceInput className="flex-1" value={filterProvince} onChange={setFilterProvince} />
                  {filterProvince && (
                    <button type="button" className="btn-ghost px-3" onClick={() => setFilterProvince("")}>
                      ล้าง
                    </button>
                  )}
                </div>
              </div>
            )}

            <SearchHint />

            <form onSubmit={search} className="flex flex-col gap-3 rounded-2xl border border-line p-3" noValidate>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm font-medium">
                  <span className="mb-1 flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-violet" /> หมวดอักษร
                  </span>
                  <input
                    className={`field ${touched && !prefixOk ? "border-warn" : ""}`}
                    placeholder="เช่น 3ฒน"
                    value={prefix}
                    maxLength={5}
                    onChange={(e) => setPrefix(e.target.value)}
                  />
                </label>
                <label className="text-sm font-medium">
                  <span className="mb-1 flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-full bg-cyan" /> เลขทะเบียน
                  </span>
                  <input
                    className={`field ${touched && !numberOk ? "border-warn" : ""}`}
                    placeholder="เช่น 5702"
                    inputMode="numeric"
                    maxLength={4}
                    value={number}
                    onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
                  />
                </label>
              </div>
              <label className="text-sm font-medium">
                <span className="mb-1 flex items-center gap-1.5">
                  <i className="h-2 w-2 rounded-full bg-warn" /> จังหวัด
                </span>
                <ProvinceInput value={province} onChange={setProvince} />
              </label>

              {touched && (!prefixOk || !numberOk || !provinceOk) && (
                <p className="text-xs text-warn">
                  {!prefixOk && "หมวดอักษรต้องเป็นตัวอักษรไทย 1–2 ตัว (มีเลขนำหน้าได้) · "}
                  {!numberOk && "เลขทะเบียน 1–4 หลัก · "}
                  {!provinceOk && "เลือกจังหวัดจากรายการ"}
                </p>
              )}

              <div className="flex items-center gap-3">
                <PlateBadge prefix={clean(prefix)} number={number} province={province} size="sm" />
                <button type="submit" className="btn-primary ml-auto" disabled={loading}>
                  {loading ? "กำลังค้นหา…" : "ค้นหา"}
                </button>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </form>

            {results ? (
              <section className="flex flex-col gap-2">
                <button
                  type="button"
                  className="self-start text-sm text-ink-3 hover:text-ink"
                  onClick={() => setResults(null)}
                >
                  ← กลับไปยังรายการทั้งหมด
                </button>
                {results.exact.length > 0 ? (
                  <>
                    <h2 className="font-bold text-emerald-400">🎉 พบป้ายของคุณ {results.exact.length} รายการ</h2>
                    {results.exact.map((h) => (
                      <HitCard key={h.plate.id} hit={h} active={selected === h.report.id} onShow={() => showHit(h)} />
                    ))}
                  </>
                ) : (
                  <div className="rounded-xl bg-surface-2 p-3 text-sm">
                    <b>ยังไม่พบป้ายนี้</b>
                    <p className="mt-1 text-ink-3">
                      ลองตรวจสอบหมวดอักษรและจังหวัดอีกครั้ง หรือกลับมาค้นหาใหม่ภายหลัง — มีผู้แจ้งพบป้ายเพิ่มขึ้นทุกวัน
                    </p>
                  </div>
                )}
                {results.near.length > 0 && (
                  <>
                    <h2 className="mt-2 text-sm font-bold">
                      ป้ายที่ใกล้เคียง{" "}
                      <span className="font-normal text-ink-3">(อาจอ่านผิด 1 ตัว หรือจังหวัดคลาดเคลื่อน)</span>
                    </h2>
                    {results.near.map((h) => (
                      <HitCard key={h.plate.id} hit={h} active={selected === h.report.id} onShow={() => showHit(h)} />
                    ))}
                  </>
                )}
              </section>
            ) : (
              <section className="flex flex-col">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-lg font-bold">จุดที่พบป้ายล่าสุด</h2>
                  <span className="text-xs text-ink-3">{visible.length} จุด</span>
                </div>
                <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
                  {Object.values(RECENCY).map((r) => (
                    <span key={r.label} className="flex items-center gap-1.5">
                      <i className="h-2.5 w-2.5 rounded-full ring-2 ring-white/80" style={{ background: r.color }} />
                      {r.label}
                    </span>
                  ))}
                </div>
                {visible.length === 0 && (
                  <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-3">
                    {filterProvince ? `ยังไม่มีผู้แจ้งพบป้ายจังหวัด${filterProvince}` : "ยังไม่มีผู้แจ้งพบป้าย"}
                  </p>
                )}
                {visible.slice(0, LIST_LIMIT).map((r) => (
                  <div
                    key={r.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(r.id, el);
                      else cardRefs.current.delete(r.id);
                    }}
                  >
                    <ReportCard report={r} active={selected === r.id} onClick={() => select(r.id)} />
                  </div>
                ))}
              </section>
            )}

            <DevCredit className="mt-auto pt-2" />
          </aside>
        </>
      )}
    </div>
  );
}

function HitCard({ hit, active, onShow }: { hit: SearchHit; active: boolean; onShow: () => void }) {
  const { plate, report } = hit;
  const photo = report.photos[plate.photo];
  return (
    <article className={`flex flex-col gap-2 rounded-lg p-2 transition ${active ? "bg-surface-2" : ""}`}>
      <button type="button" onClick={onShow} className="flex items-center gap-3 text-left">
        <span className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element -- user uploads served from our API */}
          <img
            src={`/api/files/${plate.crop}`}
            alt="รูปป้ายที่พบ"
            className="h-[70px] w-[96px] rounded-[3px] bg-black object-contain"
          />
          <RecencyBadge createdAt={report.createdAt} />
        </span>
        <span className="min-w-0 flex-1">
          <PlateBadge prefix={plate.prefix} number={plate.number} province={plate.province} size="sm" />
          <span className="mt-1 line-clamp-2 text-sm text-ink-3">
            {report.place || `${report.lat.toFixed(4)}, ${report.lng.toFixed(4)}`}
          </span>
          <span className="block text-xs text-ink-3/80">พบ {timeAgo(report.createdAt)}</span>
        </span>
      </button>
      {(report.note || report.contact) && (
        <div className="rounded-lg border border-line px-3 py-2 text-sm">
          {report.note && (
            <p>
              <span className="text-ink-3">จุดรับคืน:</span> {report.note}
            </p>
          )}
          {report.contact && (
            <p>
              <span className="text-ink-3">ติดต่อ:</span> {report.contact}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={onShow}>
          📍 ดูบนแผนที่
        </button>
        <a
          className="btn-ghost px-3 py-1.5 text-sm"
          href={`https://www.google.com/maps/dir/?api=1&destination=${report.lat},${report.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          นำทาง
        </a>
        {photo && (
          <a className="btn-ghost px-3 py-1.5 text-sm" href={`/api/files/${photo}`} target="_blank" rel="noreferrer">
            รูปเต็ม
          </a>
        )}
      </div>
    </article>
  );
}
