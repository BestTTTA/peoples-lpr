import { denyUnlessAdmin } from "@/lib/admin";
import { listPlateReviewRequests, type ReviewStatus } from "@/lib/store";

const STATUSES = new Set<ReviewStatus>(["PENDING", "APPROVED", "REJECTED"]);

export async function GET(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const raw = new URL(request.url).searchParams.get("status") ?? "PENDING";
  const status = raw as ReviewStatus;
  if (!STATUSES.has(status)) return Response.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  try {
    return Response.json(await listPlateReviewRequests(status));
  } catch (err) {
    console.error("admin list plate requests", err);
    return Response.json({ error: "โหลดคำขอไม่สำเร็จ" }, { status: 500 });
  }
}
