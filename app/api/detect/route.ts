const MAX_BYTES = 8 * 1024 * 1024;
// The detector is crop-service/ (YOLOv8, Koushim/yolov8-license-plate-detection).
// Below ~0.25 it starts boxing things that are not plates.
const CONF = Number(process.env.CROP_CONF ?? 0.25);
// A Thai plate box runs from about 2:1 to 3.4:1 (wide frames, loose padding).
const ASPECT_MIN = 1.1;
const ASPECT_MAX = 3.6;

type Upstream = { crops?: { box?: number[]; conf?: number }[] };

/**
 * Finds licence plates in one photo with the crop service and returns their
 * boxes in pixels of the image sent; the browser does the cropping.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_BYTES)
    return Response.json({ error: "ไฟล์ต้องเป็นรูปภาพขนาดไม่เกิน 8MB" }, { status: 400 });

  const upstream = new FormData();
  upstream.append("file", file, "photo.jpg");
  upstream.append("conf", String(CONF));

  const base = process.env.CROP_API_URL ?? "http://plate-crop:8000";
  try {
    const res = await fetch(`${base}/crops`, {
      method: "POST",
      body: upstream,
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json().catch(() => ({}))) as Upstream;
    if (!res.ok || !data.crops) throw new Error(`crop upstream ${res.status}`);
    const boxes = data.crops
      .filter((c) => c.box?.length === 4)
      .map((c) => ({ box: c.box as [number, number, number, number], conf: c.conf ?? 0 }))
      .filter(({ box: [x1, y1, x2, y2] }) => {
        // On photos of many plates the detector also returns boxes spanning a
        // whole row; those are far wider than any plate.
        const ratio = (x2 - x1) / Math.max(1, y2 - y1);
        return ratio >= ASPECT_MIN && ratio <= ASPECT_MAX;
      });
    return Response.json({ boxes });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "AI หาป้ายไม่สำเร็จ ลากกรอบเองได้" }, { status: 502 });
  }
}
