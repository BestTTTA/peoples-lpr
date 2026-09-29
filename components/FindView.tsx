"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import DevCredit from "@/components/DevCredit";
import FoundMap, { type Focus } from "@/components/FoundMap";
import PlateBadge from "@/components/PlateBadge";
import ProvinceInput from "@/components/ProvinceInput";
import HitCard from "@/components/HitCard";
import ReportCard, { timeAgo } from "@/components/ReportCard";
import SearchHint from "@/components/SearchHint";
import { clean, isValidNumber, isValidPrefix } from "@/lib/plate";
import { RECENCY } from "@/lib/recency";
import { toSpots } from "@/lib/spots";
import type { PublicReport, SearchHit } from "@/lib/types";
import { type PlateQuery, href, searchPath } from "@/lib/urls";
import { addWatch, removeWatch, useWatches } from "@/lib/watches";

type Results = { exact: SearchHit[]; near: SearchHit[] };

const LIST_LIMIT = 100;

function FunnelIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M3 4.5h18l-7 8.2v6.3l-4 1.5v-7.8z" />
    </svg>
  );
}

type InitialReport = { reportId: string; at: { lat: number; lng: number } | null };

export default function FindView({
  initialReport,
  initialSearch,
}: {
  /** From /จุดพบ/<id> (or the post-submit redirect): focus that report. */
  initialReport: InitialReport | null;
  /** From /ค้นหา/<plate>: fill the form in and search straight away. */
  initialSearch: PlateQuery | null;
}) {
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterProvince, setFilterProvince] = useState("");
  const [prefix, setPrefix] = useState(initialSearch?.prefix ?? "");
  const [number, setNumber] = useState(initialSearch?.number ?? "");
  const [province, setProvince] = useState(initialSearch?.province ?? "");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  /** The popup announcing a search outcome; closed by the finder. */
  const [popup, setPopup] = useState<(Results & { query: PlateQuery }) | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());


  const visible = useMemo(
    () =>
      (filterProvince ? reports.filter((r) => r.plates.some((p) => p.province === filterProvince)) : reports)
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reports, filterProvince],
  );
  // The list and the counts go by spot (reports from one place merged), like the map pins.
  const spots = useMemo(() => toSpots(visible), [visible]);
  const spotTotal = useMemo(() => toSpots(reports).length, [reports]);

  const prefixOk = isValidPrefix(prefix);
  const numberOk = isValidNumber(number);
  const plateTotal = reports.reduce((s, r) => s + r.plates.length, 0);

  function select(id: string, scroll = false) {
    const r = reports.find((x) => x.id === id);
    if (!r) return;
    setSelected(id);
    setFocus({ lat: r.lat, lng: r.lng, reportIds: [id] });
    if (scroll) {
      setPanelOpen(true);
      const spotId = spots.find((s) => s.reportIds.includes(id))?.id ?? id;
      requestAnimationFrame(() =>
        cardRefs.current.get(spotId)?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      );
    }
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!prefixOk || !numberOk) return;
    runSearch({ prefix: clean(prefix), number: clean(number), province });
  }

  async function runSearch(p: PlateQuery) {
    setLoading(true);
    setError("");
    // The address bar shows the search, so it can be shared or bookmarked.
    window.history.replaceState(null, "", href(searchPath(p.prefix, p.number, p.province)));
    try {
      const q = new URLSearchParams(p);
      const res = await fetch(`/api/search?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data);
      setPopup({ ...data, query: p });
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

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((data: PublicReport[]) => {
        setReports(data);
        // A report link: show it once the data is in.
        if (initialReport) {
          const r = data.find((x) => x.id === initialReport.reportId);
          const at = r ? { lat: r.lat, lng: r.lng } : initialReport.at;
          if (at) {
            setFocus({ ...at, reportIds: [initialReport.reportId] });
            setSelected(initialReport.reportId);
          }
        }
        if (initialSearch) runSearch(initialSearch);
      })
      .catch(() => setError("โหลดข้อมูลแผนที่ไม่สำเร็จ"));
    // Only on first load; later searches go through the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showFromPopup = (h: SearchHit) => {
    setPopup(null);
    showHit(h);
  };

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
                  {spotTotal.toLocaleString("th-TH")} จุด
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
                  <ProvinceInput className="flex-1" value={filterProvince} onChange={setFilterProvince} emptyLabel="ทุกจังหวัด" />
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
                  <span className="font-normal text-ink-3">(ไม่บังคับ)</span>
                </span>
                <ProvinceInput value={province} onChange={setProvince} emptyLabel="ทุกจังหวัด" />
              </label>

              {touched && (!prefixOk || !numberOk) && (
                <p className="text-xs text-warn">
                  {!prefixOk && "หมวดอักษรต้องเป็นตัวอักษรไทย 1–2 ตัว (มีเลขนำหน้าได้) · "}
                  {!numberOk && "เลขทะเบียน 1–4 หลัก"}
                </p>
              )}

              <div className="flex items-center gap-3">
                <PlateBadge prefix={clean(prefix)} number={number} province={province} size="sm" emptyProvince="ทุกจังหวัด" />
                <button type="submit" className="btn-primary ml-auto" disabled={loading}>
                  {loading ? "กำลังค้นหา…" : "ค้นหา"}
                </button>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </form>

            <WatchList onPick={runSearch} />

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
                  <span className="text-xs text-ink-3">{spots.length} จุด</span>
                </div>
                <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-3">
                  {Object.values(RECENCY).map((r) => (
                    <span key={r.label} className="flex items-center gap-1.5">
                      <i className="h-2.5 w-2.5 rounded-full ring-2 ring-white/80" style={{ background: r.color }} />
                      {r.label}
                    </span>
                  ))}
                </div>
                {spots.length === 0 && (
                  <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-3">
                    {filterProvince ? `ยังไม่มีผู้แจ้งพบป้ายจังหวัด${filterProvince}` : "ยังไม่มีผู้แจ้งพบป้าย"}
                  </p>
                )}
                {spots.slice(0, LIST_LIMIT).map((r) => (
                  <div
                    key={r.id}
                    ref={(el) => {
                      if (el) cardRefs.current.set(r.id, el);
                      else cardRefs.current.delete(r.id);
                    }}
                  >
                    <ReportCard
                      report={r}
                      active={selected !== null && r.reportIds.includes(selected)}
                      onClick={() => select(r.id)}
                    />
                  </div>
                ))}
              </section>
            )}

            <DevCredit className="mt-auto pt-2" />
          </aside>
        </>
      )}

      {popup && (
        <SearchPopup
          result={popup}
          onClose={() => setPopup(null)}
          onShow={showFromPopup}
          onShowNear={() => {
            setPopup(null);
            setPanelOpen(true);
          }}
        />
      )}
    </div>
  );
}

/** Announces a search outcome: found (with where to collect it) or not yet. */
function SearchPopup({
  result,
  onClose,
  onShow,
  onShowNear,
}: {
  result: Results & { query: PlateQuery };
  onClose: () => void;
  onShow: (h: SearchHit) => void;
  onShowNear: () => void;
}) {
  const { exact, near, query } = result;
  const found = exact.length > 0;
  const [copied, setCopied] = useState(false);
  const [watchError, setWatchError] = useState(false);
  const watches = useWatches();
  const watched = watches.some(
    (w) => w.prefix === query.prefix && w.number === query.number && w.province === query.province,
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {}
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-popup-title"
        className="card flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto p-4"
      >
        <div className="flex items-start gap-3">
          <div className="text-4xl leading-none">{found ? "🎉" : "🔍"}</div>
          <div className="min-w-0 flex-1">
            <h2 id="search-popup-title" className={`text-lg font-bold ${found ? "text-emerald-400" : ""}`}>
              {found ? "เจอแล้ว! มีคนพบป้ายของคุณ" : "ยังไม่มีข้อมูลป้ายทะเบียนนี้"}
            </h2>
            <p className="text-sm text-ink-3">
              {found
                ? exact.length > 1
                  ? `พบ ${exact.length} รายการ ดูจุดรับคืนและช่องทางติดต่อด้านล่าง`
                  : "ดูจุดรับคืนและช่องทางติดต่อด้านล่าง"
                : "ยังไม่มีผู้แจ้งพบป้ายนี้ในระบบ"}
            </p>
          </div>
          <button type="button" className="icon-btn shrink-0" aria-label="ปิด" onClick={onClose}>
            ✕
          </button>
        </div>

        {!found && (
          <div className="self-center">
            <PlateBadge
              prefix={query.prefix}
              number={query.number}
              province={query.province}
              size="sm"
              emptyProvince="ทุกจังหวัด"
            />
          </div>
        )}

        {found ? (
          exact.map((h) => <HitCard key={h.plate.id} hit={h} active={false} onShow={() => onShow(h)} />)
        ) : (
          <>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-3">
              <li>ตรวจหมวดอักษร เลขทะเบียน และจังหวัดอีกครั้ง</li>
              <li>มีผู้แจ้งพบป้ายเพิ่มขึ้นทุกวัน กดฝากตามหาไว้ แล้วเราจะเตือนเมื่อกลับมาเปิดเว็บนี้</li>
            </ul>
            {watched ? (
              <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                🔔 ฝากตามหาแล้ว — เมื่อมีคนแจ้งพบป้ายนี้ จะมีแจ้งเตือนตอนคุณกลับมาเปิดเว็บ (ในเครื่องและเบราว์เซอร์นี้)
              </p>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={() => (addWatch(query) ? null : setWatchError(true))}
              >
                🔔 ฝากตามหาป้ายนี้
              </button>
            )}
            {watchError && (
              <p className="text-sm text-warn">เบราว์เซอร์นี้ไม่อนุญาตให้บันทึก (อาจเป็นโหมดไม่ระบุตัวตน) — ใช้ลิงก์ด้านล่างแทน</p>
            )}
            <div className="flex flex-wrap gap-2">
              {near.length > 0 && (
                <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={onShowNear}>
                  ดูป้ายที่ใกล้เคียง ({near.length})
                </button>
              )}
              <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={copyLink}>
                {copied ? "✓ คัดลอกลิงก์แล้ว" : "🔗 คัดลอกลิงก์ไว้ค้นหาอีกครั้ง"}
              </button>
            </div>
          </>
        )}

        <button type="button" className="btn-ghost" onClick={onClose}>
          {found ? "ปิด" : "ค้นหาป้ายอื่น"}
        </button>
      </div>
    </div>
  );
}

/** Plates this browser asked us to keep looking for, with a way to drop them. */
function WatchList({ onPick }: { onPick: (q: PlateQuery) => void }) {
  const watches = useWatches();
  if (watches.length === 0) return null;
  return (
    <section className="rounded-2xl border border-line p-3">
      <h3 className="mb-2 text-sm font-semibold">🔔 ป้ายที่ฝากตามหา ({watches.length})</h3>
      <ul className="flex flex-col gap-2">
        {watches.map((w) => (
          <li key={`${w.prefix}${w.number}${w.province}`} className="flex items-center gap-2">
            <button type="button" onClick={() => onPick(w)} title="ค้นหาอีกครั้ง">
              <PlateBadge prefix={w.prefix} number={w.number} province={w.province} size="sm" emptyProvince="ทุกจังหวัด" />
            </button>
            <span className="flex-1 text-xs text-ink-3">ฝากไว้ {timeAgo(w.since)}</span>
            <button type="button" className="text-xs text-ink-3 hover:text-red-400" onClick={() => removeWatch(w)}>
              เลิกตามหา
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
