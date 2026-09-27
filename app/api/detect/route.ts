const MAX_BYTES = 8 * 1024 * 1024;
// The detector is tuned on plates mounted on cars and scores loose plates on a
// table low; below ~0.1 it starts boxing things that are not plates.
const CONF = Number(process.env.CROP_CONF ?? 0.1);
const ASPECT_MIN = 1.1;
const ASPECT_MAX = 3.0;

type Upstream = { crops?: { box?: number[]; conf?: number }[] };

/**
 * Finds licence plates in one photo with the crop service (YOLO) and returns
 * their boxes in pixels of the image sent. The service also returns each crop as
 * base64; the client crops locally, so only the boxes go back to the browser.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/") || file.size > MAX_BYTES)
    return Response.json({ error: "ไฟล์ต้องเป็นรูปภาพขนาดไม่เกิน 8MB" }, { status: 400 });

  const upstream = new FormData();
  upstream.append("file", file, "photo.jpg");
  upstream.append("conf", String(CONF));

  const base = process.env.CROP_API_URL ?? "https://cropmunmun.trafvix.com";
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
        // A Thai plate is about 2:1 (up to ~3:1 in a frame). On photos of many
        // plates the detector also returns boxes spanning a whole row; drop them.
        const ratio = (x2 - x1) / Math.max(1, y2 - y1);
        return ratio >= ASPECT_MIN && ratio <= ASPECT_MAX;
      });
    return Response.json({ boxes });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "AI หาป้ายไม่สำเร็จ ลากกรอบเองได้" }, { status: 502 });
  }
}
