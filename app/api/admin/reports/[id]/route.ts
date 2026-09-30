import { denyUnlessAdmin } from "@/lib/admin";
import { deleteReport } from "@/lib/store";

const UUID = /^[0-9a-f-]{36}$/;

/** Admin: delete a whole report, its plates and its photos. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/reports/[id]">) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "ไม่พบเคสนี้" }, { status: 404 });
  const ok = await deleteReport(id);
  if (!ok) return Response.json({ error: "ไม่พบเคสนี้ (อาจถูกลบไปแล้ว)" }, { status: 404 });
  console.log(`admin: deleted report ${id}`);
  return Response.json({ deleted: id });
}
