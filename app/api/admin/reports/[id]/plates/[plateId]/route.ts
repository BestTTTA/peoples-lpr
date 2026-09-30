import { denyUnlessAdmin } from "@/lib/admin";
import { deletePlate } from "@/lib/store";

const UUID = /^[0-9a-f-]{36}$/;

/** Admin: delete one plate from a report; the last one takes the report with it. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/reports/[id]/plates/[plateId]">) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const { id, plateId } = await ctx.params;
  if (!UUID.test(id) || !UUID.test(plateId)) return Response.json({ error: "ไม่พบป้ายนี้" }, { status: 404 });
  const result = await deletePlate(id, plateId);
  if (result === "missing") return Response.json({ error: "ไม่พบป้ายนี้ (อาจถูกลบไปแล้ว)" }, { status: 404 });
  console.log(`admin: deleted plate ${plateId} of report ${id}${result === "report" ? " (last plate: report removed)" : ""}`);
  return Response.json({ deleted: result });
}
