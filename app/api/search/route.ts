import type { NextRequest } from "next/server";
import { clean, distance, isValidNumber, isValidPrefix } from "@/lib/plate";
import { isProvince } from "@/lib/provinces";
import { listReports } from "@/lib/store";
import type { SearchHit } from "@/lib/types";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const prefix = clean(q.get("prefix") ?? "");
  const number = clean(q.get("number") ?? "");
  const province = q.get("province") ?? "";

  // Prefix and number are required; the province is optional ("" = any province).
  if (!isValidPrefix(prefix) || !isValidNumber(number) || (province !== "" && !isProvince(province)))
    return Response.json({ error: "กรุณากรอกหมวดอักษรและเลขทะเบียนให้ครบ" }, { status: 400 });

  const target = prefix + number;
  const exact: SearchHit[] = [];
  const near: SearchHit[] = [];

  for (const r of await listReports()) {
    const report = {
      id: r.id,
      createdAt: r.createdAt,
      lat: r.lat,
      lng: r.lng,
      place: r.place ?? "",
      note: r.note,
      contact: r.contact,
      photos: r.photos,
    };
    for (const p of r.plates) {
      const text = p.prefix + p.number;
      // A plate reported without a province could be anyone's with that text.
      const sameProvince = province === "" || p.province === "" || p.province === province;
      if (text === target && sameProvince) exact.push({ report, plate: p });
      // Near misses cover a single mis-read character, or the right plate
      // filed under another province (province OCR is the weaker read).
      else if ((sameProvince && distance(text, target) === 1) || (!sameProvince && text === target))
        near.push({ report, plate: p });
    }
  }

  const newest = (a: SearchHit, b: SearchHit) => b.report.createdAt.localeCompare(a.report.createdAt);
  return Response.json({ exact: exact.sort(newest), near: near.sort(newest).slice(0, 10) });
}
