import { randomUUID } from "node:crypto";
import { clean, isValidNumber, isValidPrefix } from "@/lib/plate";
import { isProvince } from "@/lib/provinces";
import { allowRequest } from "@/lib/rate-limit";
import { addPlateCorrectionRequest } from "@/lib/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PlateText = { prefix: string; number: string; province: string };

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

function parsePlate(value: unknown): PlateText | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  const prefix = clean(String(p.prefix ?? ""));
  const number = clean(String(p.number ?? ""));
  const province = String(p.province ?? "");
  if (!isValidPrefix(prefix) || !isValidNumber(number) || (province !== "" && !isProvince(province))) return null;
  return { prefix, number, province };
}

/** Public correction request: the canonical plate changes only after admin approval. */
export async function PATCH(request: Request, ctx: { params: Promise<{ plateId: string }> }) {
  if (!allowRequest(request, "plate-correction", 20, 10 * 60_000))
    return bad("ส่งข้อมูลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่", 429);
  const { plateId } = await ctx.params;
  if (!UUID.test(plateId)) return bad("ไม่พบป้ายนี้", 404);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const current = parsePlate(body?.current);
  const corrected = parsePlate(body?.corrected);
  const requestId = String(body?.requestId ?? "");
  if (!current || !corrected || !UUID.test(requestId)) return bad("ข้อมูลหมายเลขป้ายไม่ถูกต้อง");
  if (
    current.prefix === corrected.prefix &&
    current.number === corrected.number &&
    current.province === corrected.province
  )
    return bad("ข้อมูลที่แก้ไขยังเหมือนเดิม");

  try {
    const result = await addPlateCorrectionRequest(randomUUID(), plateId, current, corrected, requestId);
    if (result === "missing") return bad("ไม่พบป้ายนี้", 404);
    if (result === "conflict") return bad("ข้อมูลป้ายมีการเปลี่ยนแปลงแล้ว กรุณาค้นหาใหม่", 409);
    return Response.json({ submitted: true }, { status: 201 });
  } catch (err) {
    console.error("submit plate correction", err);
    return bad("ส่งคำขอแก้ไขไม่สำเร็จ กรุณาลองใหม่", 500);
  }
}
