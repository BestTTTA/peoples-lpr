import { denyUnlessAdmin } from "@/lib/admin";
import { detect } from "@/lib/detect";
import { sanitizeDetect, sanitizeModels } from "@/lib/detect-config";

// Try draft settings and model choice on an image: every model's raw and kept
// boxes, and which one auto-crop would use.
export async function POST(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const form = await request.formData();
  const file = form.get("file");
  const parse = (k: string) => {
    try {
      return JSON.parse(String(form.get(k) ?? "null"));
    } catch {
      return null;
    }
  };
  const settings = sanitizeDetect(parse("settings"));
  const choice = sanitizeModels(parse("models"));
  if (!(file instanceof File) || !file.type.startsWith("image/"))
    return Response.json({ error: "เลือกรูปภาพก่อน" }, { status: 400 });
  if (!settings || !choice) return Response.json({ error: "ค่าไม่ถูกต้อง" }, { status: 400 });

  const t0 = Date.now();
  const { best, candidates } = await detect(file, settings, choice);
  return Response.json({ ms: Date.now() - t0, chosen: best?.model ?? null, candidates });
}
