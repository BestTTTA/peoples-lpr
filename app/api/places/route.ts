import { searchPlaces } from "@/lib/geocode";

// Place search for the pin step: /api/places?q=ซอยลาดพร้าว 101&lat=13.7&lng=100.6
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return Response.json({ error: "พิมพ์อย่างน้อย 2 ตัวอักษร" }, { status: 400 });

  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const near = url.searchParams.has("lat") && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;

  try {
    return Response.json({ places: await searchPlaces(q, near) });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "ค้นหาสถานที่ไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 502 });
  }
}
