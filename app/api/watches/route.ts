import { createHash, randomBytes, randomUUID } from "node:crypto";
import { clean, isValidNumber, isValidPrefix } from "@/lib/plate";
import { isProvince } from "@/lib/provinces";
import { allowRequest } from "@/lib/rate-limit";
import { addWatchRecord, removeWatchRecord } from "@/lib/store";

// "ฝากตามหา": owners register a lost plate + their phone, and only the finder
// of that exact plate sees the match. Nothing from this endpoint is listed
// publicly: there is no GET.

const MAX_NAME = 60;
const MAX_PHONE = 40;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bad(msg: string, status = 400) {
  return Response.json({ error: msg }, { status });
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function cleanPhone(raw: string): string {
  // Keep digits and a leading + so "+66 81-234 5678" normalises but still
  // supports both local and international numbers.
  const s = raw.trim();
  const plus = s.startsWith("+") ? "+" : "";
  return plus + s.replace(/\D/g, "");
}

export async function POST(request: Request) {
  if (!allowRequest(request, "watch-create", 10, 10 * 60_000))
    return bad("ส่งรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่", 429);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("ข้อมูลไม่ถูกต้อง");
  }
  if (!body || typeof body !== "object") return bad("ข้อมูลไม่ถูกต้อง");
  const b = body as Record<string, unknown>;

  const name = String(b.name ?? "").trim().slice(0, MAX_NAME);
  const phone = cleanPhone(String(b.phone ?? "")).slice(0, MAX_PHONE);
  const prefix = clean(String(b.prefix ?? ""));
  const number = clean(String(b.number ?? ""));
  const province = String(b.province ?? "");
  const consent = b.consent === true;
  const requestId = String(b.requestId ?? "");
  const managementCode = String(b.managementCode ?? "").trim();

  if (!name) return bad("กรุณากรอกชื่อ");
  if (phone.replace(/\D/g, "").length < 9) return bad("กรุณากรอกเบอร์โทรให้ถูกต้อง");
  if (!isValidPrefix(prefix)) return bad(`หมวดอักษร "${prefix}" ไม่ถูกต้อง`);
  if (!isValidNumber(number)) return bad(`เลขทะเบียน "${number}" ไม่ถูกต้อง`);
  if (!province || !isProvince(province)) return bad("กรุณาเลือกจังหวัด");
  if (!consent) return bad("กรุณายินยอมให้ใช้ข้อมูลเพื่อการตามหา");
  if (!UUID.test(requestId)) return bad("ข้อมูลคำขอไม่ถูกต้อง");
  if (!/^\d{6}$/.test(managementCode)) return bad("กรุณากำหนดรหัสจัดการเป็นตัวเลข 6 หลัก");

  const id = randomUUID();
  const token = randomBytes(24).toString("base64url");
  try {
    await addWatchRecord(
      id,
      sha256(token),
      sha256(managementCode),
      requestId,
      { name, phone, prefix, number, province },
      new Date().toISOString(),
    );
    return Response.json({ id, token, managementCode }, { status: 201 });
  } catch (err) {
    const db = err as { code?: string; constraint?: string };
    if (db.code === "23505" && db.constraint === "watches_active_management_code_uniq")
      return bad("รหัสจัดการนี้ถูกใช้งานอยู่ กรุณากำหนดรหัสอื่น", 409);
    if (db.code === "23505" && db.constraint === "watches_request_id_uniq")
      return bad("รายการนี้ถูกส่งไปแล้ว กรุณาตรวจรายการฝากหาของคุณ", 409);
    console.error("create watch", err);
    return bad("บันทึกรายการไม่สำเร็จ กรุณาลองใหม่", 500);
  }
}

export async function DELETE(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("ข้อมูลไม่ถูกต้อง");
  }
  if (!body || typeof body !== "object") return bad("ข้อมูลไม่ถูกต้อง");
  const b = body as Record<string, unknown>;
  const id = String(b.id ?? "");
  const token = String(b.token ?? "");
  if (!id || !token) return bad("ข้อมูลไม่ครบ");
  try {
    const ok = await removeWatchRecord(id, sha256(token));
    if (!ok) return bad("ไม่พบคำฝากตามหา หรือรหัสยืนยันไม่ถูกต้อง", 404);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("cancel watch", err);
    return bad("ยกเลิกรายการไม่สำเร็จ กรุณาลองใหม่", 500);
  }
}
