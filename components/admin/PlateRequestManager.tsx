"use client";
import { useCallback, useEffect, useState } from "react";
import PlateBadge from "@/components/PlateBadge";
import type { PlateText } from "@/lib/types";

type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
type RequestKind = "FEEDBACK" | "CORRECTION";
type FeedbackType = "OWNER_RECEIVED" | "NOT_FOUND_AT_LOCATION";

type ReviewRequest = {
  id: string;
  kind: RequestKind;
  plateId: string;
  crop: string;
  place: string;
  current: PlateText;
  original: PlateText;
  aiDetected: PlateText | null;
  requested: PlateText | null;
  feedbackType: FeedbackType | null;
  reviewStatus: ReviewStatus;
  createdAt: string;
  reviewedAt: string | null;
  adminNote: string;
};

type Stats = {
  pending: number;
  approved: number;
  rejected: number;
  ownerReceived: number;
  notFoundAtLocation: number;
};

const EMPTY_STATS: Stats = { pending: 0, approved: 0, rejected: 0, ownerReceived: 0, notFoundAtLocation: 0 };
const dateFmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

const feedbackLabel = (type: FeedbackType | null) =>
  type === "OWNER_RECEIVED" ? "เจ้าของป้ายได้รับคืนแล้ว" : "ไม่พบป้าย ตามพิกัดที่แจ้ง";

export default function PlateRequestManager() {
  const [status, setStatus] = useState<ReviewStatus>("PENDING");
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (nextStatus: ReviewStatus) => {
    try {
      const res = await fetch(`/api/admin/plate-requests?status=${nextStatus}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดคำขอไม่สำเร็จ");
      setRequests(data.requests);
      setStats(data.stats);
      setNotes(Object.fromEntries((data.requests as ReviewRequest[]).map((item) => [item.id, item.adminNote])));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "โหลดคำขอไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetching the selected review queue is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(status);
  }, [load, status]);

  async function review(item: ReviewRequest, decision: "APPROVED" | "REJECTED") {
    const action = decision === "APPROVED" ? "อนุมัติ" : "ปฏิเสธ";
    if (!confirm(`${action}คำขอนี้?${decision === "APPROVED" ? "\n\nการอนุมัติจะมีผลกับข้อมูลที่แสดงต่อผู้ใช้ทันที" : ""}`)) return;
    setBusy(item.id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/plate-requests/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: item.kind, decision, adminNote: notes[item.id] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${action}ไม่สำเร็จ`);
      setMessage(`${action}คำขอเรียบร้อยแล้ว`);
      await load(status);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : `${action}ไม่สำเร็จ`);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="รอตรวจ" value={stats.pending} accent="text-warn" />
        <Stat label="อนุมัติแล้ว" value={stats.approved} accent="text-emerald-400" />
        <Stat label="ปฏิเสธแล้ว" value={stats.rejected} />
        <Stat label="คืนเจ้าของแล้ว" value={stats.ownerReceived} accent="text-emerald-400" />
        <Stat label="ไม่พบตามพิกัด" value={stats.notFoundAtLocation} accent="text-warn" />
      </div>

      <section className="card flex flex-col gap-3 p-4">
        <div>
          <h2 className="font-bold">คำขอปรับปรุงข้อมูลป้าย</h2>
          <p className="text-sm text-ink-3">ข้อมูลจริงจะเปลี่ยนเมื่อผู้ดูแลอนุมัติเท่านั้น</p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
          {(
            [
              ["PENDING", `รอตรวจ (${stats.pending})`],
              ["APPROVED", "อนุมัติแล้ว"],
              ["REJECTED", "ปฏิเสธแล้ว"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              disabled={status === key}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${status === key ? "bg-brand text-white" : "text-ink-3"}`}
              onClick={() => {
                if (status === key) return;
                setLoading(true);
                setError("");
                setRequests([]);
                setStatus(key);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading && requests.length === 0 && <p className="text-sm text-ink-3">กำลังโหลด…</p>}
        {message && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        <ul className="flex flex-col gap-3">
          {requests.map((item) => (
            <li key={`${item.kind}:${item.id}`} className={`rounded-xl border border-line p-3 ${busy === item.id ? "opacity-60" : ""}`}>
              <div className="grid gap-3 md:grid-cols-[112px_1fr]">
                {/* eslint-disable-next-line @next/next/no-img-element -- uploaded crop from our API */}
                <img src={`/api/files/${item.crop}`} alt="รูปป้ายที่ส่งคำขอ" className="h-20 w-28 rounded bg-black object-contain" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-violet/15 px-2 py-0.5 text-xs font-semibold text-violet">
                      {item.kind === "CORRECTION" ? "ขอแก้หมายเลข" : "แจ้งสถานะ"}
                    </span>
                    <span className="text-xs text-ink-3">{dateFmt.format(new Date(item.createdAt))}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-3">{item.place || "ไม่ระบุชื่อสถานที่"}</p>
                  {item.kind === "FEEDBACK" ? (
                    <p className="mt-2 font-semibold">{feedbackLabel(item.feedbackType)}</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <PlateBadge {...item.current} size="sm" />
                      <span className="text-ink-3">→</span>
                      {item.requested && <PlateBadge {...item.requested} size="sm" />}
                    </div>
                  )}
                  {item.aiDetected && (item.aiDetected.raw || item.aiDetected.prefix || item.aiDetected.number) && (
                    <p className="mt-2 text-xs text-ink-3">
                      AI อ่านเดิม: {item.aiDetected.raw || `${item.aiDetected.prefix} ${item.aiDetected.number}`} {item.aiDetected.province}
                    </p>
                  )}
                </div>
              </div>

              {status === "PENDING" ? (
                <div className="mt-3 flex flex-col gap-2">
                  <textarea
                    className="field min-h-16"
                    maxLength={500}
                    placeholder="หมายเหตุของผู้ดูแล (ไม่บังคับ)"
                    value={notes[item.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn-ghost text-red-400" disabled={!!busy} onClick={() => review(item, "REJECTED")}>
                      ปฏิเสธ
                    </button>
                    <button type="button" className="btn-primary" disabled={!!busy} onClick={() => review(item, "APPROVED")}>
                      {busy === item.id ? "กำลังบันทึก…" : "อนุมัติ"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-xs text-ink-3">
                  ตรวจเมื่อ {item.reviewedAt ? dateFmt.format(new Date(item.reviewedAt)) : "–"}
                  {item.adminNote && ` · หมายเหตุ: ${item.adminNote}`}
                </div>
              )}
            </li>
          ))}
        </ul>

        {!loading && requests.length === 0 && <p className="rounded-xl bg-surface-2 p-4 text-sm text-ink-3">ไม่มีคำขอในสถานะนี้</p>}
      </section>
    </div>
  );
}

function Stat({ label, value, accent = "" }: { label: string; value: number; accent?: string }) {
  return (
    <div className="card p-3">
      <div className={`text-2xl font-bold tabular-nums ${accent}`}>{value.toLocaleString("th-TH")}</div>
      <div className="text-xs text-ink-3">{label}</div>
    </div>
  );
}
