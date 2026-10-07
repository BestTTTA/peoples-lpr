import { createHash, randomUUID } from "node:crypto";
import { clean, isValidNumber, isValidPrefix } from "@/lib/plate";
import { isProvince } from "@/lib/provinces";
import { allowRequest } from "@/lib/rate-limit";
import { addWatchCodeResetRequest } from "@/lib/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const bad = (error: string, status = 400) => Response.json({ error }, { status });
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function cleanPhone(raw: string): string {
  const value = raw.trim();
  return (value.startsWith("+") ? "+" : "") + value.replace(/\D/g, "");
}

export async function POST(request: Request) {
  if (!allowRequest(request, "watch-code-reset", 5, 60 * 60_000))
    return bad("ส่งคำขอเปลี่ยนรหัสหลายครั้งเกินไป กรุณารอสักครู่", 429);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("ข้อมูลคำขอไม่ถูกต้อง");
  const prefix = clean(String(body.prefix ?? ""));
  const number = clean(String(body.number ?? ""));
  const province = String(body.province ?? "");
  const requesterName = String(body.requesterName ?? "").trim().slice(0, 60);
  const requesterPhone = cleanPhone(String(body.requesterPhone ?? "")).slice(0, 40);
  const newManagementCode = String(body.newManagementCode ?? "").trim();
  const requestId = String(body.requestId ?? "");

  if (!isValidPrefix(prefix) || !isValidNumber(number) || !isProvince(province))
    return bad("ข้อมูลป้ายทะเบียนไม่ถูกต้อง");
  if (!requesterName) return bad("กรุณากรอกชื่อผู้ยื่นคำขอ");
  if (requesterPhone.replace(/\D/g, "").length < 9) return bad("กรุณากรอกเบอร์โทรให้ถูกต้อง");
  if (!/^\d{6}$/.test(newManagementCode)) return bad("กรุณากำหนดรหัสใหม่เป็นตัวเลข 6 หลัก");
  if (!UUID.test(requestId)) return bad("ข้อมูลคำขอไม่ถูกต้อง");

  try {
    const result = await addWatchCodeResetRequest(
      randomUUID(),
      requestId,
      { prefix, number, province },
      requesterName,
      requesterPhone,
      sha256(newManagementCode),
    );
    if (result === "missing")
      return bad("ไม่พบรายการที่ตรงกับป้ายและเบอร์โทรนี้ กรุณาตรวจสอบข้อมูลหรือติดต่อ Admin", 404);
    return Response.json({ submitted: true, alreadyPending: result === "pending" });
  } catch (err) {
    console.error("request watch code reset", err);
    return bad("ส่งคำขอเปลี่ยนรหัสไม่สำเร็จ กรุณาลองใหม่", 500);
  }
}
