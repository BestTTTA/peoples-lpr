import { denyUnlessAdmin } from "@/lib/admin";
import { cropFetch, relay } from "@/lib/crop-service";
import { chosenModels } from "@/lib/detect-config";
import { getModelChoice } from "@/lib/detect-settings";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/models/[id]">) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const { id } = await ctx.params;
  const choice = await getModelChoice();
  if (chosenModels(choice).includes(id))
    return Response.json({ error: "โมเดลนี้ถูกใช้งานอยู่ เปลี่ยนไปใช้โมเดลอื่นก่อนแล้วค่อยลบ" }, { status: 400 });
  const res = await cropFetch(`/models/${encodeURIComponent(id)}`, { method: "DELETE", admin: true }).catch(() => null);
  return res ? relay(res) : Response.json({ error: "เรียก crop service ไม่สำเร็จ" }, { status: 502 });
}
