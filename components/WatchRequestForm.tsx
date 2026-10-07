"use client";
import { useId, useState } from "react";
import PlateBadge from "@/components/PlateBadge";
import ProvinceInput from "@/components/ProvinceInput";
import { addMyWatch } from "@/lib/my-watches";
import { clean, isValidNumber, isValidPrefix } from "@/lib/plate";
import { isProvince } from "@/lib/provinces";
import type { PlateQuery } from "@/lib/urls";

const SITE_NAME = "ป้ายทะเบียนหาย.com";

/**
 * Server-side "ฝากตามหา": the owner leaves a name + phone + plate so the
 * finder of that exact plate sees the match on their success screen and can
 * contact them. The plate is NEVER shown publicly (anti-scammer): no listing
 * endpoint. The owner's phone is shown only to the finder of a matching
 * report. Returns an {id, token} the browser keeps in localStorage so the
 * owner can cancel without an account.
 */
export default function WatchRequestForm({ query, onDone }: { query: PlateQuery; onDone: (managementCode: string) => void }) {
  const consentId = useId();
  const [prefix, setPrefix] = useState(query.prefix);
  const [number, setNumber] = useState(query.number);
  const [province, setProvince] = useState(query.province);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [managementCode, setManagementCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());

  const prefixOk = isValidPrefix(prefix);
  const numberOk = isValidNumber(number);
  const provinceOk = province !== "" && isProvince(province);
  const phoneDigits = phone.replace(/\D/g, "").length;
  const codeOk = /^\d{6}$/.test(managementCode);
  const codeMatches = codeOk && confirmCode === managementCode;
  const canSubmit = prefixOk && numberOk && provinceOk && name.trim() && phoneDigits >= 9 && codeMatches && consent && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          prefix: clean(prefix),
          number: clean(number),
          province,
          consent: true,
          requestId,
          managementCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ฝากตามหาไม่สำเร็จ");
      addMyWatch({
        id: data.id,
        token: data.token,
        managementCode: data.managementCode,
        prefix: clean(prefix),
        number: clean(number),
        province,
        since: new Date().toISOString(),
        name: name.trim(),
      });
      onDone(data.managementCode);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "ฝากตามหาไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border border-brand/40 bg-brand/5 p-4" noValidate>
      <div>
        <h3 className="text-base font-bold">📮 ฝากตามหาป้ายนี้ (มีเบอร์ติดต่อ)</h3>
        <p className="mt-1 text-xs text-ink-3">
          เบอร์ของคุณจะแสดงให้เฉพาะผู้แจ้งพบป้ายนี้เท่านั้น ไม่แสดงบนหน้าเว็บ และเลขป้ายที่ฝากไว้จะไม่ประกาศต่อสาธารณะ
        </p>
      </div>

      <div className="flex items-center justify-center">
        <PlateBadge prefix={clean(prefix)} number={clean(number)} province={province} size="sm" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm font-medium">
          <span className="mb-1 block">หมวดอักษร</span>
          <input
            className={`field ${prefix && !prefixOk ? "border-warn" : ""}`}
            value={prefix}
            maxLength={5}
            onChange={(e) => setPrefix(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium">
          <span className="mb-1 block">เลขทะเบียน</span>
          <input
            className={`field ${number && !numberOk ? "border-warn" : ""}`}
            value={number}
            inputMode="numeric"
            maxLength={4}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, ""))}
          />
        </label>
      </div>
      <label className="text-sm font-medium">
        <span className="mb-1 block">จังหวัด</span>
        <ProvinceInput value={province} onChange={setProvince} />
        {!provinceOk && <span className="mt-1 block text-xs text-warn">จังหวัดจำเป็นสำหรับการจับคู่</span>}
      </label>

      <label className="text-sm font-medium">
        <span className="mb-1 block">ชื่อผู้ฝากตามหา</span>
        <input
          className="field"
          placeholder="ชื่อหรือชื่อเล่น"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="text-sm font-medium">
        <span className="mb-1 block">เบอร์โทรติดต่อ</span>
        <input
          className="field"
          type="tel"
          placeholder="เช่น 081-234-5678"
          value={phone}
          inputMode="tel"
          maxLength={40}
          onChange={(e) => setPhone(e.target.value)}
        />
        <span className="mt-1 block text-xs text-ink-3">
          แสดงต่อผู้แจ้งพบป้ายของคุณเท่านั้น เราไม่โทรหาคุณและไม่ส่งต่อให้ผู้อื่น
        </span>
      </label>

      <div className="grid grid-cols-2 items-end gap-2">
        <label className="min-w-0 text-sm font-medium">
          <span className="mb-1 block">กำหนดรหัสจัดการ 6 หลัก</span>
          <input
            className={`field text-center font-mono tracking-[0.25em] ${managementCode && !codeOk ? "border-warn" : ""}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={managementCode}
            onChange={(e) => setManagementCode(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <label className="min-w-0 text-sm font-medium">
          <span className="mb-1 block">ยืนยันรหัสจัดการ</span>
          <input
            className={`field text-center font-mono tracking-[0.25em] ${confirmCode && !codeMatches ? "border-warn" : ""}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <p className="col-span-2 text-xs text-ink-3">
          ใช้รหัสนี้สำหรับแก้ไขหรือยกเลิกรายการ กรุณาจดเก็บไว้ และอย่าใช้รหัสที่เดาง่าย
        </p>
      </div>

      <label htmlFor={consentId} className="flex gap-2 rounded-xl border border-line bg-surface-2/40 p-3 text-xs text-ink-3">
        <input
          id={consentId}
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          ยินยอมให้ <b className="text-ink">{SITE_NAME}</b> นำข้อมูลส่วนบุคคลของข้าพเจ้า (ชื่อ, เบอร์โทรศัพท์, ข้อมูลป้ายทะเบียน) ไปใช้
          เพื่อวัตถุประสงค์ในการตามหาป้ายทะเบียนที่สูญหายเท่านั้น โดยไม่อนุญาตให้นำไปใช้ในวัตถุประสงค์อื่น
          <br />
          <span className="text-ink-3/80">(ข้อมูลเลขป้ายและชื่อ/เบอร์จะไม่ถูกประกาศบนหน้าเว็บสาธารณะ)</span>
        </span>
      </label>

      {error && <p className="text-sm text-warn">{error}</p>}

      <button type="submit" className="btn-primary" disabled={!canSubmit}>
        {busy ? "กำลังบันทึก…" : "ฝากตามหาป้ายนี้"}
      </button>
    </form>
  );
}
