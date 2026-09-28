import { detect } from "@/lib/detect";
import { getDetectSettings, getModelChoice } from "@/lib/detect-settings";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Finds licence plates in one photo and returns their boxes in pixels of the
 * image sent; the browser does the cropping. Settings and the model(s) to use
 * (one, or two compared) come from the admin page.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_BYTES)
    return Response.json({ error: "ไฟล์ต้องเป็นรูปภาพขนาดไม่เกิน 8MB" }, { status: 400 });

  const [settings, choice] = await Promise.all([getDetectSettings(), getModelChoice()]);
  const { best, candidates } = await detect(file, settings, choice);
  if (!best) {
    console.error("detect failed:", candidates.map((c) => `${c.model}: ${c.error}`).join("; "));
    return Response.json({ error: "AI หาป้ายไม่สำเร็จ ลากกรอบเองได้" }, { status: 502 });
  }
  return Response.json({ boxes: best.boxes, model: best.model });
}
