import { denyUnlessAdmin } from "@/lib/admin";
import { sanitizeDetect } from "@/lib/detect-config";
import { DETECT_DEFAULTS, getDetectSettings, saveDetectSettings } from "@/lib/detect-settings";

export async function GET() {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  return Response.json({ settings: await getDetectSettings(), defaults: DETECT_DEFAULTS });
}

export async function PUT(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const settings = sanitizeDetect(await request.json().catch(() => null));
  if (!settings) return Response.json({ error: "ค่าไม่ถูกต้อง (สัดส่วนต่ำสุดต้องน้อยกว่าสูงสุด)" }, { status: 400 });
  await saveDetectSettings(settings);
  return Response.json({ settings });
}
