import { createHash, randomBytes, randomUUID } from "node:crypto";
import { clean, isValidNumber, isValidPrefix } from "@/lib/plate";
import { isProvince } from "@/lib/provinces";
import { addWatchRecord, removeWatchRecord } from "@/lib/store";

// "ฝากตามหา": owners register a lost plate + their phone, and only the finder
// of that exact plate sees the match. Nothing from this endpoint is listed
// publicly: there is no GET.

const MAX_NAME = 60;
const MAX_PHONE = 40;

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

  if (!name) return bad("กรุณากรอกชื่อ");
  if (phone.replace(/\D/g, "").length < 9) return bad("กรุณากรอกเบอร์โทรให้ถูกต้อง");
  if (!isValidPrefix(prefix)) return bad(`หมวดอักษร "${prefix}" ไม่ถูกต้อง`);
  if (!isValidNumber(number)) return bad(`เลขทะเบียน "${number}" ไม่ถูกต้อง`);
  if (!province || !isProvince(province)) return bad("กรุณาเลือกจังหวัด");
  if (!consent) return bad("กรุณายินยอมให้ใช้ข้อมูลเพื่อการตามหา");

  const id = randomUUID();
  const token = randomBytes(24).toString("base64url");
  await addWatchRecord(
    id,
    sha256(token),
    { name, phone, prefix, number, province },
    new Date().toISOString(),
  );
  return Response.json({ id, token }, { status: 201 });
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
  const ok = await removeWatchRecord(id, sha256(token));
  if (!ok) return bad("ไม่พบคำฝากตามหา หรือรหัสยืนยันไม่ถูกต้อง", 404);
  return Response.json({ ok: true });
}
