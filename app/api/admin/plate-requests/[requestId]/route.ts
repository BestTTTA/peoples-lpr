import { denyUnlessAdmin } from "@/lib/admin";
import {
  reviewPlateRequest,
  type PlateRequestKind,
  type ReviewDecision,
} from "@/lib/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KINDS = new Set<PlateRequestKind>(["FEEDBACK", "CORRECTION"]);
const DECISIONS = new Set<ReviewDecision>(["APPROVED", "REJECTED"]);

export async function PATCH(request: Request, ctx: { params: Promise<{ requestId: string }> }) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const { requestId } = await ctx.params;
  if (!UUID.test(requestId)) return Response.json({ error: "ไม่พบคำขอนี้" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = String(body?.kind ?? "") as PlateRequestKind;
  const decision = String(body?.decision ?? "") as ReviewDecision;
  const adminNote = String(body?.adminNote ?? "").trim().slice(0, 500);
  if (!KINDS.has(kind) || !DECISIONS.has(decision))
    return Response.json({ error: "ข้อมูลการตรวจสอบไม่ถูกต้อง" }, { status: 400 });

  try {
    const result = await reviewPlateRequest(kind, requestId, decision, adminNote);
    if (result === "missing") return Response.json({ error: "ไม่พบคำขอนี้" }, { status: 404 });
    if (result === "already-reviewed") return Response.json({ error: "คำขอนี้ได้รับการตรวจสอบแล้ว" }, { status: 409 });
    if (result === "stale")
      return Response.json({ error: "ข้อมูลป้ายเปลี่ยนไปแล้ว ไม่สามารถอนุมัติคำขอนี้ได้" }, { status: 409 });
    return Response.json({ reviewed: true, decision });
  } catch (err) {
    console.error("admin review plate request", err);
    return Response.json({ error: "บันทึกผลการตรวจสอบไม่สำเร็จ" }, { status: 500 });
  }
}
