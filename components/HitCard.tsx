"use client";
import { useRef, useState } from "react";
import PhotoViewer from "@/components/PhotoViewer";
import PlateBadge from "@/components/PlateBadge";
import ProvinceInput from "@/components/ProvinceInput";
import { RecencyBadge, timeAgo } from "@/components/ReportCard";
import { clientUuid } from "@/lib/client-uuid";
import { clean, isValidNumber, isValidPrefix } from "@/lib/plate";
import { isProvince } from "@/lib/provinces";
import type { PlateText, SearchHit } from "@/lib/types";

type FeedbackType = "OWNER_RECEIVED" | "NOT_FOUND_AT_LOCATION";

/** A search match: plate photo, where it was found, pickup note and contact, and actions. */
export default function HitCard({ hit, active, onShow }: { hit: SearchHit; active: boolean; onShow: () => void }) {
  const { plate, report } = hit;
  const photo = report.photos[plate.photo];
  const [viewing, setViewing] = useState<string | null>(null);
  const displayPlate: PlateText = {
    prefix: plate.prefix,
    number: plate.number,
    province: plate.province,
  };
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | "">("");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [prefix, setPrefix] = useState(plate.prefix);
  const [number, setNumber] = useState(plate.number);
  const [province, setProvince] = useState(plate.province);
  const [busy, setBusy] = useState<"feedback" | "correction" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const feedbackRequestId = useRef<string | null>(null);
  const correctionRequestId = useRef<string | null>(null);

  const correctionValid = isValidPrefix(prefix) && isValidNumber(number) && (province === "" || isProvince(province));

  async function submitFeedback() {
    if (!feedbackType || busy) return;
    const label = feedbackType === "OWNER_RECEIVED" ? "เจ้าของป้ายได้รับคืนแล้ว" : "ไม่พบป้าย ตามพิกัดที่แจ้ง";
    if (!confirm(`ยืนยันส่งคำขอว่า “${label}”?`)) return;
    feedbackRequestId.current ??= clientUuid();
    setBusy("feedback");
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/plates/${plate.id}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ feedbackType, requestId: feedbackRequestId.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "แจ้งปรับปรุงข้อมูลไม่สำเร็จ");
      setMessage("ส่งคำขอปรับปรุงข้อมูลเรียบร้อยแล้ว กรุณารอผู้ดูแลตรวจสอบ");
      setFeedbackOpen(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "แจ้งปรับปรุงข้อมูลไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }

  async function submitCorrection() {
    const corrected = { prefix: clean(prefix), number: clean(number), province };
    if (!correctionValid || busy) return;
    if (
      corrected.prefix === displayPlate.prefix &&
      corrected.number === displayPlate.number &&
      corrected.province === displayPlate.province
    ) {
      setError("ข้อมูลที่แก้ไขยังเหมือนเดิม");
      return;
    }
    if (!confirm(`ยืนยันส่งคำขอแก้หมายเลขป้ายเป็น ${corrected.prefix} ${corrected.number} ${corrected.province || "ไม่ระบุจังหวัด"}?`)) return;
    correctionRequestId.current ??= clientUuid();
    setBusy("correction");
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/plates/${plate.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current: displayPlate, corrected, requestId: correctionRequestId.current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "แก้ไขหมายเลขป้ายไม่สำเร็จ");
      setMessage("ส่งคำขอแก้ไขหมายเลขป้ายเรียบร้อยแล้ว กรุณารอผู้ดูแลตรวจสอบ");
      setCorrectionOpen(false);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "แก้ไขหมายเลขป้ายไม่สำเร็จ");
    } finally {
      setBusy("");
    }
  }

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
          <PlateBadge prefix={displayPlate.prefix} number={displayPlate.number} province={displayPlate.province} size="sm" />
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
          <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setViewing(`/api/files/${photo}`)}>
            รูปเต็ม
          </button>
        )}
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-sm"
          onClick={() => {
            setFeedbackOpen((value) => !value);
            setCorrectionOpen(false);
            setError("");
          }}
        >
          แจ้งปรับปรุงข้อมูล
        </button>
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-sm"
          onClick={() => {
            setCorrectionOpen((value) => !value);
            setFeedbackOpen(false);
            setError("");
          }}
        >
          ขอแก้ไขหมายเลขป้าย
        </button>
      </div>

      {feedbackOpen && (
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
          <label className="font-medium">
            ข้อมูลที่ต้องการแจ้ง
            <select
              className="field mt-1"
              value={feedbackType}
              onChange={(e) => {
                setFeedbackType(e.target.value as FeedbackType | "");
                feedbackRequestId.current = null;
              }}
            >
              <option value="">เลือกสถานะ</option>
              <option value="OWNER_RECEIVED">เจ้าของป้ายได้รับคืนแล้ว</option>
              <option value="NOT_FOUND_AT_LOCATION">ไม่พบป้าย ตามพิกัดที่แจ้ง</option>
            </select>
          </label>
          <button type="button" className="btn-primary" disabled={!feedbackType || !!busy} onClick={submitFeedback}>
            {busy === "feedback" ? "กำลังส่งคำขอ…" : "ส่งคำขอปรับปรุง"}
          </button>
        </div>
      )}

      {correctionOpen && (
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3 text-sm">
          <p className="text-ink-3">
            ค่าปัจจุบัน: <b className="text-ink">{displayPlate.prefix} {displayPlate.number} {displayPlate.province || "ไม่ระบุจังหวัด"}</b>
          </p>
          {plate.aiDetected && (plate.aiDetected.prefix || plate.aiDetected.number || plate.aiDetected.province) && (
            <p className="text-xs text-ink-3">
              AI อ่านเดิม: {plate.aiDetected.raw || `${plate.aiDetected.prefix || "–"} ${plate.aiDetected.number || "–"}`} {plate.aiDetected.province || "ไม่ระบุจังหวัด"}
            </p>
          )}
          {plate.correctedAt && plate.original && (
            <p className="text-xs text-ink-3">
              ข้อมูลก่อนแก้ล่าสุด: {plate.original.prefix} {plate.original.number} {plate.original.province || "ไม่ระบุจังหวัด"}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="font-medium">
              หมวดอักษรที่ถูกต้อง
              <input
                className="field mt-1"
                maxLength={5}
                value={prefix}
                onChange={(e) => {
                  setPrefix(e.target.value);
                  correctionRequestId.current = null;
                }}
              />
            </label>
            <label className="font-medium">
              เลขทะเบียนที่ถูกต้อง
              <input
                className="field mt-1"
                inputMode="numeric"
                maxLength={4}
                value={number}
                onChange={(e) => {
                  setNumber(e.target.value.replace(/\D/g, ""));
                  correctionRequestId.current = null;
                }}
              />
            </label>
          </div>
          <label className="font-medium">
            จังหวัด
            <ProvinceInput
              className="mt-1"
              value={province}
              onChange={(value) => {
                setProvince(value);
                correctionRequestId.current = null;
              }}
              emptyLabel="ไม่ระบุจังหวัด"
            />
          </label>
          <button type="button" className="btn-primary" disabled={!correctionValid || !!busy} onClick={submitCorrection}>
            {busy === "correction" ? "กำลังส่งคำขอ…" : "ส่งคำขอแก้ไข"}
          </button>
        </div>
      )}

      {message && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{message}</p>}
      {error && <p className="text-sm text-warn">{error}</p>}
      {viewing && <PhotoViewer src={viewing} alt="รูปที่ผู้แจ้งถ่ายไว้" onClose={() => setViewing(null)} />}
    </article>
  );
}
