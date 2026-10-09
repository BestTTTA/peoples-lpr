"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import DevCredit from "@/components/DevCredit";
import FoundMap, { type Focus } from "@/components/FoundMap";
import HitCard from "@/components/HitCard";
import PlateBadge from "@/components/PlateBadge";
import ProvinceInput from "@/components/ProvinceInput";
import { timeAgo } from "@/components/ReportCard";
import WatchManager from "@/components/WatchManager";
import WelcomeChooser from "@/components/WelcomeChooser";
import WatchRequestForm from "@/components/WatchRequestForm";
import { type MyWatch, removeMyWatch, useMyWatches } from "@/lib/my-watches";
import { clean, isValidNumber, isValidPrefix, splitPlate } from "@/lib/plate";
import type { PublicReport, SearchHit } from "@/lib/types";
import { type PlateQuery, REPORT_PATH, href, searchPath } from "@/lib/urls";
import { addWatch, removeWatch, useWatches } from "@/lib/watches";

type Results = { exact: SearchHit[]; near: SearchHit[] };

const WELCOMED = "peoples-lpr:welcomed";

function Icon({ children, className = "h-5 w-5" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const SearchIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icon>
);

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
  const [plateText, setPlateText] = useState(initialSearch ? `${initialSearch.prefix} ${initialSearch.number}` : "");
  const [province, setProvince] = useState(initialSearch?.province ?? "");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [query, setQuery] = useState<PlateQuery | null>(initialSearch);
  /** The "not found yet" popup (watch options); closed by the finder. */
  const [popup, setPopup] = useState(false);
  const plateInput = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLElement>(null);
  const scrollToMap = useRef(false);
  /** "What are you here for?" on arriving at the home page, once per visit. */
  const [welcome, setWelcome] = useState(false);

  // One field for the whole plate: "3ฒน 5702", "3ฒน5702" or "3ฒน-5702" all split the same way.
  const parsed = useMemo(() => splitPlate(plateText), [plateText]);
  const plateOk = isValidPrefix(parsed.prefix) && isValidNumber(parsed.number);

  /** What the map draws: the search matches, or (for a /จุดพบ link) every report. */
  const mapReports = useMemo<PublicReport[]>(() => {
    if (!results) return reports;
    const full = new Map(reports.map((r) => [r.id, r]));
    const byId = new Map<string, PublicReport>();
    for (const { report, plate } of [...results.exact, ...results.near]) {
      let entry = byId.get(report.id);
      if (!entry) {
        const { id, createdAt, lat, lng, place } = report;
        entry = full.get(id) ?? { id, createdAt, lat, lng, place: place ?? "", plates: [] };
        byId.set(id, entry);
      }
      if (!full.has(report.id)) entry.plates.push({ prefix: plate.prefix, number: plate.number, province: plate.province });
    }
    return [...byId.values()];
  }, [results, reports]);

  const focusId = focus?.reportIds[0];
  const focusReport = mapReports.find((r) => r.id === focusId);
  const focusNote = [...(results?.exact ?? []), ...(results?.near ?? [])].find((h) => h.report.id === focusId)?.report
    .note;

  function select(id: string) {
    const r = mapReports.find((x) => x.id === id);
    if (!r) return;
    setSelected(id);
    setFocus({ lat: r.lat, lng: r.lng, reportIds: [id] });
  }

  const showHit = (h: SearchHit) => {
    scrollToMap.current = true;
    setSelected(h.report.id);
    setFocus({ lat: h.report.lat, lng: h.report.lng, reportIds: [h.report.id] });
  };

  function search(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!plateOk) return;
    runSearch({ prefix: clean(parsed.prefix), number: clean(parsed.number), province });
  }

  async function runSearch(p: PlateQuery) {
    setLoading(true);
    setError("");
    setQuery(p);
    setPlateText(`${p.prefix} ${p.number}`);
    setProvince(p.province);
    // The address bar shows the search, so it can be shared or bookmarked.
    window.history.replaceState(null, "", href(searchPath(p.prefix, p.number, p.province)));
    try {
      const res = await fetch(`/api/search?${new URLSearchParams(p)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data);
      const hits = data.exact as SearchHit[];
      // No exact match: still put the closest ones on the map.
      const first = hits[0] ?? (data.near as SearchHit[])[0];
      setPopup(!hits[0]);
      if (first) {
        setSelected(first.report.id);
        setFocus({
          lat: first.report.lat,
          lng: first.report.lng,
          reportIds: hits[0] ? hits.map((h) => h.report.id) : [first.report.id],
        });
      } else {
        setSelected(null);
        setFocus(null);
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "ค้นหาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Only a /จุดพบ link needs the reports: show that one once the data is in.
    if (!initialReport) return;
    fetch("/api/reports")
      .then((r) => r.json())
      .then((data: PublicReport[]) => {
        setReports(data);
        const r = data.find((x) => x.id === initialReport.reportId);
        const at = r ? { lat: r.lat, lng: r.lng } : initialReport.at;
        if (at) {
          setFocus({ ...at, reportIds: [initialReport.reportId] });
          setSelected(initialReport.reportId);
        }
      })
      .catch(() => {
        if (initialReport.at) {
          setFocus({ ...initialReport.at, reportIds: [initialReport.reportId] });
          setSelected(initialReport.reportId);
        }
      });
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialSearch) runSearch(initialSearch);
    // Only on first load; later searches go through the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialSearch || initialReport) return; // came with a purpose (a search or report link)
    let seen = false;
    try {
      seen = sessionStorage.getItem(WELCOMED) === "1";
    } catch {}
    if (seen) return;
    const id = requestAnimationFrame(() => setWelcome(true));
    return () => cancelAnimationFrame(id);
  }, [initialSearch, initialReport]);

  function closeWelcome() {
    setWelcome(false);
    try {
      sessionStorage.setItem(WELCOMED, "1");
    } catch {}
  }

  useEffect(() => {
    if (results) resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [results]);

  useEffect(() => {
    if (focus && scrollToMap.current) mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    scrollToMap.current = false;
  }, [focus]);

  function focusSearch() {
    plateInput.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    plateInput.current?.focus({ preventScroll: true });
  }

  const mapCard = focus && (
    <section ref={mapRef} className="card scroll-mt-4 overflow-hidden">
      <div className="h-[340px] sm:h-[420px]">
        <FoundMap reports={mapReports} focus={focus} onSelect={select} />
      </div>
      <div className="flex flex-col gap-3 border-t border-line p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-ink-3">จุดพบ / จุดรับคืน</div>
          <div className="font-semibold">{focusReport?.place || `${focus.lat.toFixed(5)}, ${focus.lng.toFixed(5)}`}</div>
          {focusNote && <p className="text-sm text-ink-3">{focusNote}</p>}
        </div>
        <a
          className="btn-primary"
          href={`https://www.google.com/maps/dir/?api=1&destination=${focus.lat},${focus.lng}`}
          target="_blank"
          rel="noreferrer"
        >
          🧭 นำทางด้วย Google Maps
        </a>
      </div>
    </section>
  );

  return (
    <div className="dark-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
      <section className="border-b border-line bg-surface">
        <div className="mx-auto w-full max-w-[830px] px-4 py-6 text-center sm:py-9">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              สำหรับเจ้าของป้ายที่ทำหล่นหรือสูญหาย
            </span>
            <span className="rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-semibold text-emerald-400">
              ค้นหาฟรี · ไม่เรียกเก็บเงิน
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">ป้ายของคุณหายใช่ไหม?</h1>
          <p className="mt-2 text-ink-3 sm:text-lg">
            กรอกเลขทะเบียนเพื่อเช็กว่ามีผู้แจ้งพบแล้วหรือยัง ดูตำแหน่งบนแผนที่ และฝากตามหาไว้ได้
          </p>

          <form
            onSubmit={search}
            noValidate
            className="mt-5 rounded-3xl border border-brand/30 bg-surface p-4 text-left shadow-lg ring-4 ring-brand/10 sm:p-5"
          >
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_230px_auto] md:items-end">
              <label className="text-sm font-medium">
                <span className="mb-1 flex items-center gap-1.5">
                  <i className="h-2 w-2 rounded-full bg-violet" /> ทะเบียนรถ
                </span>
                <input
                  ref={plateInput}
                  className={`field py-3.5 text-xl ${touched && !plateOk ? "border-warn" : ""}`}
                  placeholder="เช่น 3ฒน 5702"
                  value={plateText}
                  maxLength={14}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setPlateText(e.target.value)}
                />
              </label>

              <label className="text-sm font-medium">
                <span className="mb-1 flex items-center gap-1.5">
                  <i className="h-2 w-2 rounded-full bg-warn" /> จังหวัด
                  <span className="font-normal text-ink-3">(ไม่บังคับ)</span>
                </span>
                <ProvinceInput
                  className="[&_.field]:py-3.5 [&_.field]:text-lg"
                  value={province}
                  onChange={setProvince}
                  emptyLabel="ทุกจังหวัด"
                />
              </label>

              <button type="submit" className="btn-primary px-7 py-3.5 text-lg" disabled={loading}>
                <SearchIcon className="h-5 w-5" />
                {loading ? "กำลังค้นหา…" : "ค้นหา"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <PlateBadge prefix={clean(parsed.prefix)} number={parsed.number} province={province} size="sm" emptyProvince="ทุกจังหวัด" />
              <span className="text-xs text-ink-3">พิมพ์ติดกัน เว้นวรรค หรือใช้ขีดได้ เช่น 3ฒน5702, 3ฒน 5702</span>
            </div>

            {touched && !plateOk && (
              <p className="mt-2 text-xs text-warn">
                กรอกทะเบียนให้ครบ: หมวดอักษรไทย 1–2 ตัว (มีเลขนำหน้าได้) แล้วตามด้วยเลข 1–4 หลัก เช่น 3ฒน 5702
              </p>
            )}
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </form>

          <p className="mt-4 text-sm text-ink-3">
            ส่วนนี้ใช้เมื่อป้ายของคุณหาย · พบหรือเก็บป้ายของผู้อื่นได้?{" "}
            <Link href={href(REPORT_PATH)} className="font-semibold text-brand underline">
              ไปแจ้งป้ายที่พบ →
            </Link>
          </p>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-[830px] flex-1 flex-col gap-4 px-4 py-6 sm:py-8">
        <MyWatchesList onPick={runSearch} />
        <WatchManager />
        <WatchList onPick={runSearch} />

        {results && (
          <div ref={resultsRef} className="flex scroll-mt-4 flex-col gap-4">
            {results.exact.length > 0 ? (
              <section className="card flex flex-col gap-2 p-4">
                <h2 className="font-bold text-emerald-400">🎉 พบป้ายของคุณ {results.exact.length} รายการ</h2>
                {results.exact.map((h) => (
                  <HitCard key={h.plate.id} hit={h} active={selected === h.report.id} onShow={() => showHit(h)} />
                ))}
              </section>
            ) : (
              <section className="card flex flex-col gap-3 p-4 text-sm">
                <div>
                  <b className="text-base">ยังไม่พบป้ายนี้</b>
                  <p className="mt-1 text-ink-3">
                    ลองตรวจสอบหมวดอักษรและจังหวัดอีกครั้ง หรือฝากตามหาไว้ — มีผู้แจ้งพบป้ายเพิ่มขึ้นทุกวัน
                  </p>
                </div>
                <button type="button" className="btn-primary self-start" onClick={() => setPopup(true)}>
                  🔔 ฝากตามหาป้ายนี้
                </button>
              </section>
            )}

            {mapCard}

            {results.near.length > 0 && (
              <section className="card flex flex-col gap-2 p-4">
                <h2 className="text-sm font-bold">
                  ป้ายที่ใกล้เคียง{" "}
                  <span className="font-normal text-ink-3">(อาจอ่านผิด 1 ตัว หรือจังหวัดคลาดเคลื่อน)</span>
                </h2>
                {results.near.map((h) => (
                  <HitCard key={h.plate.id} hit={h} active={selected === h.report.id} onShow={() => showHit(h)} />
                ))}
              </section>
            )}
          </div>
        )}

        {/* A /จุดพบ link without a search: just that spot on the map. */}
        {!results && mapCard}
      </div>

      <DevCredit className="pb-6" />

      {welcome && (
        <WelcomeChooser
          onClose={closeWelcome}
          onSearch={() => {
            closeWelcome();
            focusSearch();
          }}
        />
      )}

      {popup && query && (
        <SearchPopup query={query} nearCount={results?.near.length ?? 0} onClose={() => setPopup(false)} />
      )}
    </div>
  );
}

/** Announces that nothing was found yet, and offers to keep looking (watch). */
function SearchPopup({
  query,
  nearCount,
  onClose,
}: {
  query: PlateQuery;
  nearCount: number;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [watchError, setWatchError] = useState(false);
  const [serverForm, setServerForm] = useState(false);
  const [serverCode, setServerCode] = useState("");
  const watches = useWatches();
  const myWatches = useMyWatches();
  const same = (w: PlateQuery) =>
    w.prefix === query.prefix && w.number === query.number && w.province === query.province;
  const watched = watches.some(same);
  const serverWatched = myWatches.some(same);

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
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-popup-title"
        className="card flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto p-4 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="text-4xl leading-none">🔍</div>
          <div className="min-w-0 flex-1">
            <h2 id="search-popup-title" className="text-lg font-bold">
              ยังไม่มีข้อมูลป้ายทะเบียนนี้
            </h2>
            <p className="text-sm text-ink-3">ยังไม่มีผู้แจ้งพบป้ายนี้ในระบบ</p>
          </div>
          <button type="button" className="icon-btn shrink-0" aria-label="ปิด" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="self-center">
          <PlateBadge
            prefix={query.prefix}
            number={query.number}
            province={query.province}
            size="sm"
            emptyProvince="ทุกจังหวัด"
          />
        </div>

        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-3">
          <li>ตรวจหมวดอักษร เลขทะเบียน และจังหวัดอีกครั้ง</li>
          <li>มีผู้แจ้งพบป้ายเพิ่มขึ้นทุกวัน กดฝากตามหาไว้ แล้วเราจะเตือนเมื่อกลับมาเปิดเว็บนี้</li>
        </ul>
        {watched ? (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            🔔 ฝากตามหาแล้ว — เมื่อมีคนแจ้งพบป้ายนี้ จะมีแจ้งเตือนตอนคุณกลับมาเปิดเว็บ (ในเครื่องและเบราว์เซอร์นี้)
          </p>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => (addWatch(query) ? null : setWatchError(true))}>
            🔔 ฝากตามหาแบบเตือนในเบราว์เซอร์นี้
          </button>
        )}
        {watchError && (
          <p className="text-sm text-warn">เบราว์เซอร์นี้ไม่อนุญาตให้บันทึก (อาจเป็นโหมดไม่ระบุตัวตน) — ใช้ลิงก์ด้านล่างแทน</p>
        )}

        {serverCode ? (
          <div className="rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm">
            <b className="text-emerald-400">📮 ฝากตามหาเรียบร้อยแล้ว</b>
            <p className="mt-1 text-ink-3">เก็บรหัสนี้ไว้สำหรับแก้ไขหรือยกเลิกรายการ</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-surface px-3 py-2 text-center text-xl font-bold tracking-[0.3em] text-ink">
                {serverCode}
              </code>
              <button
                type="button"
                className="btn-ghost px-3 py-2 text-sm"
                onClick={() => navigator.clipboard.writeText(serverCode).catch(() => {})}
              >
                คัดลอก
              </button>
            </div>
            <p className="mt-2 text-xs text-warn">นี่คือรหัสที่คุณกำหนด กรุณาจดเก็บไว้ก่อนปิดหน้าต่าง</p>
          </div>
        ) : serverWatched ? (
          <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            📮 ฝากตามหาเรียบร้อยแล้ว — ผู้แจ้งพบป้ายนี้จะเห็นเบอร์คุณและติดต่อกลับได้ทันที
          </p>
        ) : serverForm ? (
          <WatchRequestForm query={query} onDone={setServerCode} />
        ) : (
          <button type="button" className="btn-primary" onClick={() => setServerForm(true)}>
            📮 ฝากตามหา + ทิ้งเบอร์ให้ผู้แจ้งพบติดต่อ
          </button>
        )}
        <div className="flex flex-wrap gap-2">
          {nearCount > 0 && (
            <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={onClose}>
              ดูป้ายที่ใกล้เคียง ({nearCount})
            </button>
          )}
          <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={copyLink}>
            {copied ? "✓ คัดลอกลิงก์แล้ว" : "🔗 คัดลอกลิงก์ไว้ค้นหาอีกครั้ง"}
          </button>
        </div>

        <button type="button" className="btn-ghost" onClick={onClose}>
          ค้นหาป้ายอื่น
        </button>
      </div>
    </div>
  );
}

/** Server-side "ฝากตามหา" entries this browser owns (phone + name stored on the
 * server). The owner cancels theirs here with the token kept in localStorage. */
function MyWatchesList({ onPick }: { onPick: (q: PlateQuery) => void }) {
  const watches = useMyWatches();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (watches.length === 0) return null;
  async function cancel(w: MyWatch) {
    if (!confirm(`ยกเลิกคำฝากตามหา ${w.prefix}${w.number} ${w.province}?`)) return;
    setBusy(w.id);
    setError("");
    try {
      const res = await fetch("/api/watches", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: w.id, token: w.token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ยกเลิกรายการไม่สำเร็จ");
      removeMyWatch(w.id);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "ยกเลิกรายการไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="rounded-2xl border border-brand/40 bg-brand/5 p-3">
      <h3 className="mb-2 text-sm font-semibold">📮 ฝากตามหาที่ทิ้งเบอร์ไว้ ({watches.length})</h3>
      <ul className="flex flex-col gap-2">
        {watches.map((w) => (
          <li key={w.id} className="flex items-center gap-2">
            <button type="button" onClick={() => onPick(w)} title="ค้นหาอีกครั้ง">
              <PlateBadge prefix={w.prefix} number={w.number} province={w.province} size="sm" />
            </button>
            <span className="flex-1 text-xs text-ink-3">
              ในชื่อ <b className="text-ink">{w.name}</b> · ฝากไว้ {timeAgo(w.since)}
            </span>
            <button
              type="button"
              className="text-xs text-ink-3 hover:text-red-400 disabled:opacity-50"
              disabled={busy === w.id}
              onClick={() => cancel(w)}
            >
              {busy === w.id ? "…" : "ยกเลิก"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-warn">{error}</p>}
    </section>
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
