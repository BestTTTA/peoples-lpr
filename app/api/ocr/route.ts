import type { OcrResult } from "@/lib/types";

const MAX_FILES = 30;
const MAX_BYTES = 4 * 1024 * 1024;
// The OCR API rejects requests with more than 8 images (HTTP 400).
const UPSTREAM_BATCH = Number(process.env.OCR_MAX_BATCH ?? 8);

type Upstream = {
  results?: (Partial<OcrResult> & { index: number })[];
  detail?: unknown;
};

async function ocrBatch(files: File[], key: string): Promise<OcrResult[]> {
  const upstream = new FormData();
  files.forEach((f, i) => upstream.append("file", f, `plate-${i}.jpg`));

  const base = process.env.OCR_API_URL ?? "https://ocrapi.roljetson.com";
  const res = await fetch(`${base}/ocr`, {
    method: "POST",
    headers: { "x-api-key": key },
    body: upstream,
  });
  const data = (await res.json().catch(() => ({}))) as Upstream;
  if (!res.ok || !data.results) throw new Error(`OCR upstream ${res.status}: ${JSON.stringify(data.detail)}`);

  return files.map((_, i) => {
    const r = data.results!.find((x) => x.index === i);
    return {
      plate_number: r?.plate_number ?? "",
      province: r?.province ?? "",
      plate_confidence: r?.plate_confidence ?? 0,
      province_confidence: r?.province_confidence ?? 0,
    };
  });
}

// Proxies the OCR API so the key never reaches the browser. The client sends
// one cropped plate per `file` field; they go upstream in batches the API accepts.
export async function POST(request: Request) {
  const key = process.env.OCR_API_KEY;
  if (!key) return Response.json({ error: "OCR_API_KEY ไม่ได้ตั้งค่า" }, { status: 500 });

  const form = await request.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length === 0) return Response.json({ error: "ไม่มีรูปป้าย" }, { status: 400 });
  if (files.length > MAX_FILES)
    return Response.json({ error: `ส่งได้สูงสุด ${MAX_FILES} ป้ายต่อครั้ง` }, { status: 400 });
  if (files.some((f) => f.size > MAX_BYTES || !f.type.startsWith("image/")))
    return Response.json({ error: "ไฟล์ต้องเป็นรูปภาพขนาดไม่เกิน 4MB" }, { status: 400 });

  const chunks: File[][] = [];
  for (let i = 0; i < files.length; i += UPSTREAM_BATCH) chunks.push(files.slice(i, i + UPSTREAM_BATCH));

  try {
    const results = (await Promise.all(chunks.map((c) => ocrBatch(c, key)))).flat();
    return Response.json({ results });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "อ่านป้ายไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 502 });
  }
}
