import { randomUUID } from "node:crypto";
import { sanitizeBox, sanitizeExtraBoxes } from "@/lib/boxes";
import { MAX_PLATES } from "@/lib/limits";
import { normalizeSourceUrl } from "@/lib/source-url";
import { clean, isValidNumber, isValidPrefix } from "@/lib/plate";
import { isProvince } from "@/lib/provinces";
import { reverseGeocode } from "@/lib/geocode";
import { addReport, listReports, listWatchMatches, saveFile } from "@/lib/store";
import type { Plate, PublicReport, Report } from "@/lib/types";

const MAX_PHOTOS = 10;
const MAX_BYTES = 6 * 1024 * 1024;

export async function GET() {
  const reports = await listReports();
  const out: PublicReport[] = reports.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    lat: r.lat,
    lng: r.lng,
    place: r.place ?? "",
    // Plate text is public (the dashboard lists it); pickup details come from /api/search.
    plates: r.plates.map((p) => ({ prefix: p.prefix, number: p.number, province: p.province })),
  }));
  return Response.json(out);
}

type Meta = {
  /** null/absent for a report with a pickup note only (no pin). */
  lat?: number | null;
  lng?: number | null;
  note?: string;
  contact?: string;
  sourceUrl?: string;
  plates: {
    prefix: string;
    number: string;
    province: string;
    photo: number;
    box?: unknown;
    aiPrefix?: unknown;
    aiNumber?: unknown;
    aiProvince?: unknown;
    aiRawPlate?: unknown;
  }[];
  /** AI boxes the finder deleted, plates boxed but left out: training data. */
  extraBoxes?: unknown;
};

function bad(msg: string) {
  return Response.json({ error: msg }, { status: 400 });
}

function isImage(f: FormDataEntryValue): f is File {
  return f instanceof File && f.type.startsWith("image/") && f.size <= MAX_BYTES;
}

export async function POST(request: Request) {
  const form = await request.formData();
  let meta: Meta;
  try {
    meta = JSON.parse(String(form.get("meta")));
  } catch {
    return bad("ข้อมูลไม่ถูกต้อง");
  }
  const photos = form.getAll("photo");
  const crops = form.getAll("crop");

  const note = String(meta.note ?? "").trim().slice(0, 500);
  const noPin = meta.lat == null && meta.lng == null;
  const lat = noPin ? null : Number(meta.lat);
  const lng = noPin ? null : Number(meta.lng);
  if (lat !== null && lng !== null) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      return bad("ตำแหน่งที่ปักหมุดไม่ถูกต้อง");
  } else if (noPin) {
    // Without a pin the note is the only way to say where the plates can be collected.
    if (note.length < 5) return bad("กรุณาปักหมุด หรือระบุจุดรับคืนเป็นข้อความ");
  } else return bad("ตำแหน่งที่ปักหมุดไม่ถูกต้อง");
  const sourceUrl = normalizeSourceUrl(String(meta.sourceUrl ?? ""));
  if (sourceUrl === null) return bad("ลิงก์โพสต์ต้นทางต้องเป็นลิงก์เว็บ เช่น https://facebook.com/…");
  if (!Array.isArray(meta.plates) || meta.plates.length === 0) return bad("ไม่มีป้ายทะเบียน");
  if (meta.plates.length > MAX_PLATES) return bad(`ส่งได้สูงสุด ${MAX_PLATES} ป้าย`);
  if (photos.length === 0 || photos.length > MAX_PHOTOS) return bad("จำนวนรูปไม่ถูกต้อง");
  if (crops.length !== meta.plates.length) return bad("จำนวนรูปป้ายไม่ตรงกับข้อมูล");
  if (![...photos, ...crops].every(isImage)) return bad("ไฟล์ต้องเป็นรูปภาพขนาดไม่เกิน 6MB");

  for (const p of meta.plates) {
    if (!isValidPrefix(p.prefix)) return bad(`หมวดอักษร "${p.prefix}" ไม่ถูกต้อง`);
    if (!isValidNumber(p.number)) return bad(`เลขทะเบียน "${p.number}" ไม่ถูกต้อง`);
    // "" = the finder could not tell the province (worn plate, bad read).
    if (p.province !== "" && !isProvince(p.province)) return bad(`ไม่พบจังหวัด "${p.province}"`);
    if (!Number.isInteger(p.photo) || p.photo < 0 || p.photo >= photos.length)
      return bad("ข้อมูลรูปไม่ถูกต้อง");
  }

  const photoNames: string[] = [];
  for (const f of photos as File[]) {
    const name = `${randomUUID()}.jpg`;
    await saveFile(name, new Uint8Array(await f.arrayBuffer()));
    photoNames.push(name);
  }

  const plates: Plate[] = [];
  for (const [i, p] of meta.plates.entries()) {
    const name = `${randomUUID()}.jpg`;
    await saveFile(name, new Uint8Array(await (crops[i] as File).arrayBuffer()));
    plates.push({
      id: randomUUID(),
      prefix: clean(p.prefix),
      number: clean(p.number),
      province: p.province,
      aiDetected:
        String(p.aiPrefix ?? "") || String(p.aiNumber ?? "") || String(p.aiProvince ?? "") || String(p.aiRawPlate ?? "")
          ? {
              prefix: clean(String(p.aiPrefix ?? "")).slice(0, 5),
              number: clean(String(p.aiNumber ?? "")).slice(0, 4),
              province: String(p.aiProvince ?? "").slice(0, 80),
              raw: String(p.aiRawPlate ?? "").trim().slice(0, 40),
            }
          : null,
      crop: name,
      photo: p.photo,
      // Where it is in the photo, for training the detector; a bad box is dropped, not an error.
      box: sanitizeBox(p.box),
    });
  }

  const report: Report = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    lat,
    lng,
    place: lat !== null && lng !== null ? await reverseGeocode(lat, lng) : "",
    note,
    contact: String(meta.contact ?? "").slice(0, 200),
    sourceUrl,
    photos: photoNames,
    plates,
    extraBoxes: sanitizeExtraBoxes(meta.extraBoxes, photoNames.length),
  };
  await addReport(report);
  // Owners who used "ฝากตามหา" see nothing public about this report; the finder
  // sees the match (name + phone) here, on the success screen, to coordinate
  // the return.
  const matches = await listWatchMatches(
    report.plates.map((p) => ({ prefix: p.prefix, number: p.number, province: p.province })),
  ).catch(() => []);
  return Response.json({ id: report.id, matches }, { status: 201 });
}
