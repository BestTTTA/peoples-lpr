import { denyUnlessAdmin } from "@/lib/admin";
import { reviewWatchCodeResetRequest } from "@/lib/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECISIONS = new Set(["APPROVED", "REJECTED"]);

export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/watch-code-resets/[requestId]">) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const { requestId } = await ctx.params;
  if (!UUID.test(requestId)) return Response.json({ error: "ไม่พบคำขอนี้" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const decision = String(body?.decision ?? "") as "APPROVED" | "REJECTED";
  const adminNote = String(body?.adminNote ?? "").trim().slice(0, 500);
  if (!DECISIONS.has(decision)) return Response.json({ error: "ข้อมูลการตรวจสอบไม่ถูกต้อง" }, { status: 400 });

  try {
    const result = await reviewWatchCodeResetRequest(requestId, decision, adminNote);
    if (result === "missing") return Response.json({ error: "ไม่พบคำขอนี้" }, { status: 404 });
    if (result === "already-reviewed") return Response.json({ error: "คำขอนี้ได้รับการตรวจสอบแล้ว" }, { status: 409 });
    if (result === "stale")
      return Response.json({ error: "รายการหรือรหัสเดิมเปลี่ยนไปแล้ว ไม่สามารถอนุมัติคำขอนี้ได้" }, { status: 409 });
    return Response.json({ reviewed: true, decision });
  } catch (err) {
    const db = err as { code?: string; constraint?: string };
    if (db.code === "23505" && db.constraint === "watches_active_plate_management_code_uniq")
      return Response.json({ error: "รหัสใหม่ซ้ำกับรายการอื่นของป้ายเดียวกัน กรุณาปฏิเสธคำขอนี้" }, { status: 409 });
    console.error("admin review watch code reset", err);
    return Response.json({ error: "บันทึกผลการตรวจสอบไม่สำเร็จ" }, { status: 500 });
  }
}
