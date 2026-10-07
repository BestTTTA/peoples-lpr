"use client";
import { useCallback, useEffect, useState } from "react";
import LocationPicker, { type LatLng } from "@/components/LocationPicker";
import PhotoViewer from "@/components/PhotoViewer";
import PlateBadge from "@/components/PlateBadge";
import type { Report } from "@/lib/types";
import { href, reportPath } from "@/lib/urls";

type Page = { total: number; page: number; pageSize: number; reports: Report[] };

const dateFmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });
const PREVIEW = 24;

/** Admin: find reports (plate, place, note, contact) and delete a whole report or single plates. */
export default function ReportManager() {
  const [query, setQuery] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<string | null>(null);
  const [moving, setMoving] = useState<Report | null>(null);

  const fetchPage = useCallback(async (q: string, p: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/reports?${new URLSearchParams({ q, page: String(p) })}`);
      const data = (await res.json()) as Page & { error?: string };
      if (!res.ok) throw new Error(data.error);
      setReports((prev) => (p === 0 ? data.reports : [...prev, ...data.reports]));
      setTotal(data.total);
      setPage(p);
    } catch (e) {
      setError((e as Error).message || "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  // Search as you type, debounced.
  useEffect(() => {
    const t = setTimeout(() => fetchPage(query.trim(), 0), 350);
    return () => clearTimeout(t);
  }, [query, fetchPage]);

  async function removeReport(r: Report) {
    const plates = r.plates.map((p) => `${p.prefix}${p.number}`).slice(0, 5).join(", ");
    const more = r.plates.length > 5 ? ` และอีก ${r.plates.length - 5} ป้าย` : "";
    if (!confirm(`ลบเคสนี้ทั้งเคส?\n\nป้าย: ${plates}${more}\nแจ้งเมื่อ ${dateFmt.format(new Date(r.createdAt))}\n\nรูปและข้อมูลจะถูกลบถาวร กู้คืนไม่ได้`))
      return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/reports/${r.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReports((prev) => prev.filter((x) => x.id !== r.id));
      setTotal((t) => t - 1);
    } catch (e) {
      setError((e as Error).message || "ลบไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }

  async function removePlate(r: Report, plateId: string) {
    const p = r.plates.find((x) => x.id === plateId)!;
    const last = r.plates.length === 1;
    if (!confirm(`ลบป้าย ${p.prefix} ${p.number} ${p.province}?${last ? "\n\nเป็นป้ายสุดท้ายของเคส — เคสนี้จะถูกลบทั้งเคส" : ""}`))
      return;
    setBusy(plateId);
    try {
      const res = await fetch(`/api/admin/reports/${r.id}/plates/${plateId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.deleted === "report") {
        setReports((prev) => prev.filter((x) => x.id !== r.id));
        setTotal((t) => t - 1);
      } else
        setReports((prev) => prev.map((x) => (x.id === r.id ? { ...x, plates: x.plates.filter((y) => y.id !== plateId) } : x)));
    } catch (e) {
      setError((e as Error).message || "ลบไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="card flex flex-col gap-3 p-4">
      <div>
        <h2 className="font-bold">เคสที่แจ้งพบ</h2>
        <p className="text-sm text-ink-3">ค้นหาแล้วลบเคสที่แจ้งผิด (เช่น ตั้งใจแจ้งหาแต่กดแจ้งพบ) หรือลบเฉพาะป้ายที่ผิด</p>
      </div>
      <input
        type="search"
        className="field"
        placeholder="ค้นหา: ทะเบียน (บว4617, 4617), จังหวัด, สถานที่, หมายเหตุ หรือเบอร์ติดต่อ"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="text-sm text-ink-3">
        {loading && reports.length === 0 ? "กำลังค้นหา…" : `${total.toLocaleString("th-TH")} เคส${query ? " ที่ตรงกับคำค้น" : ""}`}
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}

      <ul className="flex flex-col gap-3">
        {reports.map((r) => {
          const open = expanded.has(r.id);
          const plates = open ? r.plates : r.plates.slice(0, PREVIEW);
          return (
            <li key={r.id} className={`rounded-xl border border-line p-3 ${busy === r.id ? "opacity-50" : ""}`}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex shrink-0 gap-1">
                  {r.photos.slice(0, 3).map((ph) => (
                    <button key={ph} type="button" onClick={() => setViewing(`/api/files/${ph}`)} title="ดูรูปเต็ม">
                      {/* eslint-disable-next-line @next/next/no-img-element -- user uploads served from our API */}
                      <img src={`/api/files/${ph}`} alt="" className="h-16 w-20 rounded object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="font-semibold">
                    {r.plates.length} ป้าย · {dateFmt.format(new Date(r.createdAt))}
                  </div>
                  <div className="text-ink-3">{r.place || `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`}</div>
                  {r.note && (
                    <div className="mt-1">
                      <span className="text-ink-3">หมายเหตุ:</span> {r.note}
                    </div>
                  )}
                  {r.contact && (
                    <div>
                      <span className="text-ink-3">ติดต่อ:</span> {r.contact}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1.5">
                  <a
                    className="btn-ghost px-3 py-1.5 text-center text-sm"
                    href={href(reportPath(r.id))}
                    target="_blank"
                    rel="noreferrer"
                  >
                    ดูบนแผนที่
                  </a>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-sm"
                    disabled={!!busy}
                    onClick={() => setMoving(r)}
                  >
                    📍 แก้ตำแหน่ง
                  </button>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-sm text-red-400 hover:border-red-500"
                    disabled={!!busy}
                    onClick={() => removeReport(r)}
                  >
                    🗑 ลบเคสนี้
                  </button>
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2">
                {plates.map((p) => (
                  <li key={p.id} className={`relative flex flex-col items-center gap-1 ${busy === p.id ? "opacity-40" : ""}`}>
                    <PlateBadge prefix={p.prefix} number={p.number} province={p.province} size="sm" />
                    {p.status && p.status !== "ACTIVE" && (
                      <span className={`text-[10px] font-semibold ${p.status === "OWNER_RECEIVED" ? "text-emerald-400" : "text-warn"}`}>
                        {p.status === "OWNER_RECEIVED" ? "คืนเจ้าของแล้ว" : "ไม่พบตามพิกัด"}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`ลบป้าย ${p.prefix} ${p.number}`}
                      title="ลบป้ายนี้"
                      disabled={!!busy}
                      onClick={() => removePlate(r, p.id)}
                      className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-[11px] text-white"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              {r.plates.length > PREVIEW && (
                <button
                  type="button"
                  className="mt-2 text-sm text-brand"
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (open) next.delete(r.id);
                      else next.add(r.id);
                      return next;
                    })
                  }
                >
                  {open ? "ย่อ" : `แสดงทั้งหมด (${r.plates.length} ป้าย)`}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {reports.length < total && (
        <button type="button" className="btn-ghost self-center" disabled={loading} onClick={() => fetchPage(query.trim(), page + 1)}>
          {loading ? "กำลังโหลด…" : `โหลดเพิ่ม (${total - reports.length})`}
        </button>
      )}
      {viewing && <PhotoViewer src={viewing} alt="รูปที่ผู้แจ้งถ่ายไว้" onClose={() => setViewing(null)} />}
      {moving && (
        <MoveDialog
          report={moving}
          onClose={() => setMoving(null)}
          onMoved={(m) => {
            setReports((prev) => prev.map((x) => (x.id === m.id ? { ...x, lat: m.lat, lng: m.lng, place: m.place } : x)));
            setMoving(null);
          }}
        />
      )}
    </section>
  );
}

/** Move a report's pin: search a place, paste a Google Maps link, drag or tap. */
function MoveDialog({
  report,
  onClose,
  onMoved,
}: {
  report: Report;
  onClose: () => void;
  onMoved: (m: { id: string; lat: number; lng: number; place: string }) => void;
}) {
  const [at, setAt] = useState<LatLng>({ lat: report.lat, lng: report.lng });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = at.lat !== report.lat || at.lng !== report.lng;

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/admin/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(at),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) return setError(data?.error ?? "บันทึกไม่สำเร็จ");
    onMoved(data);
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="แก้ตำแหน่ง" className="card flex max-h-[92vh] w-full max-w-2xl flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold">แก้ตำแหน่งจุดที่พบ</h3>
            <p className="truncate text-sm text-ink-3">
              {report.plates.length} ป้าย · ตอนนี้: {report.place || `${report.lat.toFixed(5)}, ${report.lng.toFixed(5)}`}
            </p>
          </div>
          <button type="button" className="icon-btn shrink-0" aria-label="ปิด" onClick={onClose}>
            ✕
          </button>
        </div>
        <LocationPicker value={at} onChange={setAt} centerOnValue />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" disabled={!changed || busy} onClick={save}>
            {busy ? "กำลังบันทึก…" : "บันทึกตำแหน่งใหม่"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setAt({ lat: report.lat, lng: report.lng })} disabled={!changed}>
            กลับตำแหน่งเดิม
          </button>
          <span className="text-xs text-ink-3">ชื่อสถานที่จะอัปเดตตามตำแหน่งใหม่ให้อัตโนมัติ</span>
        </div>
      </div>
    </div>
  );
}
