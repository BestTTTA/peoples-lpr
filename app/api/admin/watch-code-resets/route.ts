import { denyUnlessAdmin } from "@/lib/admin";
import { listWatchCodeResetRequests, type ReviewStatus } from "@/lib/store";

const STATUSES = new Set<ReviewStatus>(["PENDING", "APPROVED", "REJECTED"]);

export async function GET(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const status = (new URL(request.url).searchParams.get("status") ?? "PENDING") as ReviewStatus;
  if (!STATUSES.has(status)) return Response.json({ error: "สถานะไม่ถูกต้อง" }, { status: 400 });
  try {
    return Response.json(await listWatchCodeResetRequests(status));
  } catch (err) {
    console.error("admin list watch code resets", err);
    return Response.json({ error: "โหลดคำขอเปลี่ยนรหัสไม่สำเร็จ" }, { status: 500 });
  }
}
