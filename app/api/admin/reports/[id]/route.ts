import { denyUnlessAdmin } from "@/lib/admin";
import { reverseGeocode } from "@/lib/geocode";
import { deleteReport, updateReportLocation } from "@/lib/store";

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

/** Admin: move a report's pin (a wrong location). The place name is looked up again. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/reports/[id]">) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "ไม่พบเคสนี้" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { lat?: unknown; lng?: unknown } | null;
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    return Response.json({ error: "ตำแหน่งไม่ถูกต้อง" }, { status: 400 });
  const place = await reverseGeocode(lat, lng);
  const ok = await updateReportLocation(id, lat, lng, place);
  if (!ok) return Response.json({ error: "ไม่พบเคสนี้ (อาจถูกลบไปแล้ว)" }, { status: 404 });
  console.log(`admin: moved report ${id} to ${lat.toFixed(6)},${lng.toFixed(6)}`);
  return Response.json({ id, lat, lng, place });
}
