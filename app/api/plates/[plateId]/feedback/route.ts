import { randomUUID } from "node:crypto";
import { allowRequest } from "@/lib/rate-limit";
import { addPlateFeedback, type PlateFeedbackType } from "@/lib/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set<PlateFeedbackType>(["OWNER_RECEIVED", "NOT_FOUND_AT_LOCATION"]);

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request, ctx: { params: Promise<{ plateId: string }> }) {
  if (!allowRequest(request, "plate-feedback", 20, 10 * 60_000))
    return bad("ส่งข้อมูลถี่เกินไป กรุณารอสักครู่แล้วลองใหม่", 429);
  const { plateId } = await ctx.params;
  if (!UUID.test(plateId)) return bad("ไม่พบป้ายนี้", 404);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const feedbackType = String(body?.feedbackType ?? "") as PlateFeedbackType;
  const requestId = String(body?.requestId ?? "");
  if (!TYPES.has(feedbackType) || !UUID.test(requestId)) return bad("ข้อมูลแจ้งปรับปรุงไม่ถูกต้อง");

  try {
    const saved = await addPlateFeedback(randomUUID(), plateId, feedbackType, requestId);
    if (!saved) return bad("ไม่พบป้ายนี้", 404);
    return Response.json({ submitted: true }, { status: 201 });
  } catch (err) {
    console.error("submit plate feedback", err);
    return bad("ส่งคำขอปรับปรุงไม่สำเร็จ กรุณาลองใหม่", 500);
  }
}
