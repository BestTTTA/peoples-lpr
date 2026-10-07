"use client";
import { useState } from "react";
import PlateBadge from "@/components/PlateBadge";
import ProvinceInput from "@/components/ProvinceInput";
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

  const lookupValid = isValidPrefix(prefix) && isValidNumber(number) && isProvince(province) && /^\d{6}$/.test(managementCode);
  const editValid =
    !!name.trim() &&
    phone.replace(/\D/g, "").length >= 9 &&
    isValidPrefix(newPrefix) &&
    isValidNumber(newNumber) &&
    isProvince(newProvince);

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
      if (!res.ok) throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
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
    </section>
  );
}
