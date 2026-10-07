"use client";
import { useCallback, useEffect, useState } from "react";
import PlateBadge from "@/components/PlateBadge";

type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";
type ResetRequest = {
  id: string;
  watchId: string;
  name: string;
  phone: string;
  requesterName: string;
  requesterPhone: string;
  prefix: string;
  number: string;
  province: string;
  reviewStatus: ReviewStatus;
  createdAt: string;
  reviewedAt: string | null;
  adminNote: string;
};

const EMPTY_STATS = { pending: 0, approved: 0, rejected: 0 };
const dateFmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

export default function WatchCodeResetManager() {
  const [status, setStatus] = useState<ReviewStatus>("PENDING");
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (nextStatus: ReviewStatus) => {
    try {
      const res = await fetch(`/api/admin/watch-code-resets?status=${nextStatus}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "โหลดคำขอเปลี่ยนรหัสไม่สำเร็จ");
      setRequests(data.requests);
      setStats(data.stats);
      setNotes(Object.fromEntries((data.requests as ResetRequest[]).map((item) => [item.id, item.adminNote])));
      setError("");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "โหลดคำขอเปลี่ยนรหัสไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(status);
  }, [load, status]);

  async function review(item: ResetRequest, decision: "APPROVED" | "REJECTED") {
    const action = decision === "APPROVED" ? "อนุมัติ" : "ปฏิเสธ";
    if (!confirm(`${action}คำขอเปลี่ยนรหัสนี้?${decision === "APPROVED" ? "\n\nเมื่ออนุมัติ รหัสใหม่จะใช้งานได้ทันที" : ""}`)) return;
    setBusy(item.id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/watch-code-resets/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, adminNote: notes[item.id] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${action}คำขอไม่สำเร็จ`);
      setMessage(`${action}คำขอเปลี่ยนรหัสเรียบร้อยแล้ว`);
      await load(status);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : `${action}คำขอไม่สำเร็จ`);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="รออนุมัติ" value={stats.pending} accent="text-warn" />
        <Stat label="อนุมัติแล้ว" value={stats.approved} accent="text-emerald-400" />
        <Stat label="ปฏิเสธแล้ว" value={stats.rejected} />
      </div>

      <section className="card flex flex-col gap-3 p-4">
        <div>
          <h2 className="font-bold">คำขอเปลี่ยนรหัสจัดการรายการฝากหา</h2>
          <p className="text-sm text-ink-3">ตรวจสอบชื่อและเบอร์โทรที่ผู้ใช้ยื่นกับข้อมูลเดิมก่อนอนุมัติ ระบบไม่แสดงรหัสใหม่และเก็บไว้ในรูปแบบ hash เท่านั้น</p>
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
              className={`rounded-lg px-2 py-2 text-sm font-semibold ${status === key ? "bg-brand text-white" : "text-ink-3"}`}
              onClick={() => {
                setLoading(true);
                setRequests([]);
                setStatus(key);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {message && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {loading && requests.length === 0 && <p className="text-sm text-ink-3">กำลังโหลด…</p>}

        <ul className="flex flex-col gap-3">
          {requests.map((item) => {
            const detailsMatch = item.name === item.requesterName && item.phone === item.requesterPhone;
            return (
              <li key={item.id} className={`rounded-xl border border-line p-3 ${busy === item.id ? "opacity-60" : ""}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-2">
                    <PlateBadge prefix={item.prefix} number={item.number} province={item.province} size="sm" />
                    <span className="text-xs text-ink-3">ยื่นเมื่อ {dateFmt.format(new Date(item.createdAt))}</span>
                  </div>
                  <span className={`rounded px-2 py-1 text-xs font-semibold ${detailsMatch ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-warn"}`}>
                    {detailsMatch ? "ข้อมูลตรงกัน" : "ชื่อหรือเบอร์ไม่ตรงทั้งหมด"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-2 p-3">
                    <div className="text-xs text-ink-3">ข้อมูลเดิมในระบบ</div>
                    <div className="mt-1 font-semibold">{item.name}</div>
                    <div>{item.phone}</div>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-3">
                    <div className="text-xs text-ink-3">ข้อมูลผู้ยื่นคำขอ</div>
                    <div className="mt-1 font-semibold">{item.requesterName}</div>
                    <div>{item.requesterPhone}</div>
                  </div>
                </div>

                {status === "PENDING" ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea
                      className="field min-h-16"
                      maxLength={500}
                      placeholder="หมายเหตุของ Admin (ไม่บังคับ)"
                      value={notes[item.id] ?? ""}
                      onChange={(event) => setNotes((prev) => ({ ...prev, [item.id]: event.target.value }))}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" className="btn-ghost text-red-400" disabled={!!busy} onClick={() => review(item, "REJECTED")}>
                        ปฏิเสธ
                      </button>
                      <button type="button" className="btn-primary" disabled={!!busy} onClick={() => review(item, "APPROVED")}>
                        {busy === item.id ? "กำลังบันทึก…" : "อนุมัติเปลี่ยนรหัส"}
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
            );
          })}
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
