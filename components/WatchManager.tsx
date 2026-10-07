"use client";
import { useState } from "react";
import ContactChannels from "@/components/ContactChannels";
import PlateBadge from "@/components/PlateBadge";
import ProvinceInput from "@/components/ProvinceInput";
import { clientUuid } from "@/lib/client-uuid";
import { removeMyWatch, updateMyWatch } from "@/lib/my-watches";
import { clean, isValidNumber, isValidPrefix } from "@/lib/plate";
import { isProvince } from "@/lib/provinces";

type ManagedWatch = {
  id: string;
  name: string;
  phone: string;
  prefix: string;
  number: string;
  province: string;
  createdAt: string;
};

export default function WatchManager() {
  const [open, setOpen] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [number, setNumber] = useState("");
  const [province, setProvince] = useState("");
  const [managementCode, setManagementCode] = useState("");
  const [watch, setWatch] = useState<ManagedWatch | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPrefix, setNewPrefix] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newProvince, setNewProvince] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [resetForm, setResetForm] = useState(false);
  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [newManagementCode, setNewManagementCode] = useState("");
  const [confirmManagementCode, setConfirmManagementCode] = useState("");
  const [resetRequestId, setResetRequestId] = useState(clientUuid);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  const lookupValid = isValidPrefix(prefix) && isValidNumber(number) && isProvince(province) && /^\d{6}$/.test(managementCode);
  const editValid =
    !!name.trim() &&
    phone.replace(/\D/g, "").length >= 9 &&
    isValidPrefix(newPrefix) &&
    isValidNumber(newNumber) &&
    isProvince(newProvince);
  const resetValid =
    !!requesterName.trim() &&
    requesterPhone.replace(/\D/g, "").length >= 9 &&
    /^\d{6}$/.test(newManagementCode) &&
    newManagementCode === confirmManagementCode;

  function fill(result: ManagedWatch) {
    setWatch(result);
    setName(result.name);
    setPhone(result.phone);
    setNewPrefix(result.prefix);
    setNewNumber(result.number);
    setNewProvince(result.province);
  }

  async function request(method: "POST" | "PATCH" | "DELETE") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body: Record<string, unknown> = {
        prefix: clean(prefix),
        number: clean(number),
        province,
        managementCode,
      };
      if (method === "PATCH")
        Object.assign(body, {
          name: name.trim(),
          phone: phone.trim(),
          newPrefix: clean(newPrefix),
          newNumber: clean(newNumber),
          newProvince,
        });
      const res = await fetch("/api/watches/manage", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (method === "POST" && res.status === 404 && data.code === "INVALID_CREDENTIALS") {
          const nextAttempts = failedAttempts + 1;
          setFailedAttempts(nextAttempts);
          if (nextAttempts >= 3) {
            setShowContact(false);
            setResetForm(false);
            setResetError("");
            setResetMessage("");
            setHelpOpen(true);
          }
        }
        throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
      }
      if (method === "POST") setFailedAttempts(0);
      if (method === "DELETE") {
        if (watch) removeMyWatch(watch.id);
        setWatch(null);
        setMessage("ยกเลิกการตามหาป้ายเรียบร้อยแล้ว");
        return;
      }
      const result = data.watch as ManagedWatch;
      fill(result);
      if (method === "PATCH") {
        setPrefix(result.prefix);
        setNumber(result.number);
        setProvince(result.province);
        updateMyWatch(result.id, {
          name: result.name,
          prefix: result.prefix,
          number: result.number,
          province: result.province,
        });
        setMessage("บันทึกการแก้ไขเรียบร้อยแล้ว");
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function submitResetRequest() {
    if (!resetValid || resetBusy) return;
    setResetBusy(true);
    setResetError("");
    setResetMessage("");
    try {
      const res = await fetch("/api/watches/code-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prefix: clean(prefix),
          number: clean(number),
          province,
          requesterName: requesterName.trim(),
          requesterPhone: requesterPhone.trim(),
          newManagementCode,
          requestId: resetRequestId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ส่งคำขอเปลี่ยนรหัสไม่สำเร็จ");
      setResetMessage(
        data.alreadyPending
          ? "รายการนี้มีคำขอรออนุมัติอยู่แล้ว กรุณารอ Admin ตรวจสอบ"
          : "ส่งคำขอเรียบร้อยแล้ว รหัสจะเปลี่ยนเมื่อ Admin อนุมัติ",
      );
      setResetRequestId(clientUuid());
    } catch (err) {
      setResetError(err instanceof Error && err.message ? err.message : "ส่งคำขอเปลี่ยนรหัสไม่สำเร็จ");
    } finally {
      setResetBusy(false);
    }
  }

  if (!open)
    return (
      <button type="button" className="btn-ghost w-full text-sm" onClick={() => setOpen(true)}>
        จัดการรายการฝากหาป้าย
      </button>
    );

  return (
    <section className="rounded-2xl border border-brand/40 bg-brand/5 p-3">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">จัดการรายการฝากหาป้าย</h3>
          <p className="text-xs text-ink-3">กรอกข้อมูลป้ายเดิมและรหัสจัดการ 6 หลัก</p>
        </div>
        <button type="button" className="icon-btn shrink-0" aria-label="ปิด" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>

      {!watch ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <input className="field" placeholder="หมวดอักษร" maxLength={5} value={prefix} onChange={(e) => setPrefix(e.target.value)} />
            <input
              className="field"
              placeholder="เลขทะเบียน"
              inputMode="numeric"
              maxLength={4}
              value={number}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <ProvinceInput value={province} onChange={setProvince} />
          <input
            className="field text-center font-mono text-lg tracking-[0.3em]"
            aria-label="รหัสจัดการ 6 หลัก"
            placeholder="รหัส 6 หลัก"
            inputMode="numeric"
            maxLength={6}
            value={managementCode}
            onChange={(e) => setManagementCode(e.target.value.replace(/\D/g, ""))}
          />
          <button type="button" className="btn-primary" disabled={!lookupValid || busy} onClick={() => request("POST")}>
            {busy ? "กำลังตรวจสอบ…" : "ตรวจสอบรายการ"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex justify-center">
            <PlateBadge prefix={clean(newPrefix)} number={clean(newNumber)} province={newProvince} size="sm" />
          </div>
          <label className="text-sm font-medium">
            ชื่อผู้ฝากตามหา
            <input className="field mt-1" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-sm font-medium">
            เบอร์โทรติดต่อ
            <input className="field mt-1" type="tel" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-medium">
              หมวดอักษร
              <input className="field mt-1" maxLength={5} value={newPrefix} onChange={(e) => setNewPrefix(e.target.value)} />
            </label>
            <label className="text-sm font-medium">
              เลขทะเบียน
              <input
                className="field mt-1"
                inputMode="numeric"
                maxLength={4}
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value.replace(/\D/g, ""))}
              />
            </label>
          </div>
          <label className="text-sm font-medium">
            จังหวัด
            <ProvinceInput className="mt-1" value={newProvince} onChange={setNewProvince} />
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn-primary flex-1" disabled={!editValid || busy} onClick={() => request("PATCH")}>
              {busy ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
            </button>
            <button
              type="button"
              className="btn-ghost text-red-400"
              disabled={busy}
              onClick={() => confirm(`ยกเลิกการตามหา ${newPrefix}${newNumber} ${newProvince}?`) && request("DELETE")}
            >
              ยกเลิกการตามหา
            </button>
          </div>
          <button type="button" className="text-xs text-ink-3" onClick={() => setWatch(null)}>
            ← ใช้ข้อมูลป้ายอื่น
          </button>
        </div>
      )}

      {message && <p className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{message}</p>}
      {error && <p className="mt-2 text-sm text-warn">{error}</p>}
      {failedAttempts > 0 && failedAttempts < 3 && !watch && (
        <p className="mt-1 text-xs text-ink-3">กรอกไม่ถูกต้อง {failedAttempts} ครั้ง — หากครบ 3 ครั้ง สามารถติดต่อ Admin หรือยื่นคำขอเปลี่ยนรหัสได้</p>
      )}

      {helpOpen && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4"
          role="presentation"
          onClick={(event) => event.target === event.currentTarget && setHelpOpen(false)}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="watch-help-title" className="card flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto p-5">
            <div>
              <h2 id="watch-help-title" className="text-lg font-bold">กรอกรหัสจัดการไม่ถูกต้อง 3 ครั้ง</h2>
              <p className="mt-1 text-sm text-ink-3">
                เลือกติดต่อ Admin โดยตรง หรือยื่นคำขอเปลี่ยนรหัสเพื่อรอ Admin ตรวจสอบและอนุมัติ
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={showContact ? "btn-primary w-full" : "btn-ghost w-full"}
                onClick={() => {
                  setShowContact(true);
                  setResetForm(false);
                }}
              >
                ติดต่อ Admin
              </button>
              <button
                type="button"
                className={resetForm ? "btn-primary w-full" : "btn-ghost w-full"}
                onClick={() => {
                  setResetForm(true);
                  setShowContact(false);
                }}
              >
                ยื่นเรื่องขอเปลี่ยนรหัส
              </button>
            </div>

            {showContact && <ContactChannels className="rounded-xl border border-line bg-surface-2/40 p-3" />}

            {resetForm && (
              <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2/40 p-3">
                <div>
                  <h3 className="font-semibold">ยื่นคำขอเปลี่ยนรหัสจัดการ</h3>
                  <p className="mt-1 text-xs text-ink-3">กรอกเบอร์โทรเดียวกับที่ใช้ฝากหาป้าย และกำหนดรหัสใหม่ รหัสจะยังไม่เปลี่ยนจนกว่า Admin จะอนุมัติ</p>
                </div>
                <input
                  className="field"
                  placeholder="ชื่อผู้ยื่นคำขอ"
                  maxLength={60}
                  value={requesterName}
                  onChange={(event) => setRequesterName(event.target.value)}
                />
                <input
                  className="field"
                  type="tel"
                  inputMode="tel"
                  placeholder="เบอร์โทรที่ใช้ฝากหาป้าย"
                  maxLength={40}
                  value={requesterPhone}
                  onChange={(event) => setRequesterPhone(event.target.value)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="field text-center font-mono tracking-[0.2em]"
                    inputMode="numeric"
                    placeholder="รหัสใหม่ 6 หลัก"
                    maxLength={6}
                    value={newManagementCode}
                    onChange={(event) => setNewManagementCode(event.target.value.replace(/\D/g, ""))}
                  />
                  <input
                    className="field text-center font-mono tracking-[0.2em]"
                    inputMode="numeric"
                    placeholder="ยืนยันรหัสใหม่"
                    maxLength={6}
                    value={confirmManagementCode}
                    onChange={(event) => setConfirmManagementCode(event.target.value.replace(/\D/g, ""))}
                  />
                </div>
                {resetError && <p className="text-sm text-warn">{resetError}</p>}
                {resetMessage && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{resetMessage}</p>}
                <button type="button" className="btn-primary w-full" disabled={!resetValid || resetBusy || !!resetMessage} onClick={submitResetRequest}>
                  {resetBusy ? "กำลังส่งคำขอ…" : "ส่งให้ Admin อนุมัติ"}
                </button>
              </div>
            )}

            <button type="button" className="btn-ghost w-full" onClick={() => setHelpOpen(false)}>
              ปิด
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
