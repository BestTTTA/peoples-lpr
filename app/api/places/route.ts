import { searchPlaces } from "@/lib/geocode";
import { isGoogleMapsUrl, parseCoords, resolveGoogleMaps } from "@/lib/gmaps";

// Place search for the pin step. q may be a name (/api/places?q=ซอยลาดพร้าว 101&lat=…&lng=…),
// a Google Maps share link (https://maps.app.goo.gl/…), or coordinates ("13.7108, 100.7024").
export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = (url.searchParams.get("q") ?? "").trim();

  const coords = parseCoords(raw);
  if (coords)
    return Response.json({
      places: [
        {
          name: "พิกัดที่ระบุ",
          detail: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
          ...coords,
          bbox: null,
        },
      ],
    });

  if (isGoogleMapsUrl(raw)) {
    try {
      const place = await resolveGoogleMaps(raw.slice(0, 2000));
      if (place) return Response.json({ places: [place] });
      return Response.json(
        { error: "ลิงก์นี้ไม่มีตำแหน่ง ลองกด “แชร์” จากหมุดใน Google Maps แล้วคัดลอกลิงก์ใหม่" },
        { status: 422 },
      );
    } catch (err) {
      console.error(err);
      return Response.json({ error: "เปิดลิงก์ Google Maps ไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 502 });
    }
  }
  if (/^https?:\/\//i.test(raw))
    return Response.json({ error: "รองรับเฉพาะลิงก์จาก Google Maps" }, { status: 400 });

  const q = raw.slice(0, 120);
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
