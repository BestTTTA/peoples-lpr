import "server-only";

type NominatimAddress = Partial<
  Record<
    | "road"
    | "quarter"
    | "suburb"
    | "village"
    | "city_district"
    | "district"
    | "county"
    | "town"
    | "city"
    | "state"
    | "province",
    string
  >
>;

/**
 * Short Thai place name for a pin, e.g. "ถนนสุขุมวิท, ปากน้ำ, เมืองสมุทรปราการ, สมุทรปราการ".
 * Uses OpenStreetMap Nominatim (max ~1 req/s, fine at report-submission rate).
 * Returns "" on any failure; the place name is a nicety, not required.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&accept-language=th&lat=${lat}&lon=${lng}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PeoplesLPR/1.0 (lost licence plate finder)" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return "";
    const { address = {} } = (await res.json()) as { address?: NominatimAddress };
    const parts = [
      address.road,
      address.quarter ?? address.suburb ?? address.village,
      address.town,
      address.city_district ?? address.district ?? address.county ?? address.city,
      address.state ?? address.province,
    ].filter((p): p is string => !!p);
    return [...new Set(parts)].join(", ");
  } catch {
    return "";
  }
}

export type Place = {
  name: string;
  detail: string;
  lat: number;
  lng: number;
  /** [west, south, east, north], for fitting the map to a province or district. */
  bbox: [number, number, number, number] | null;
};

type NominatimHit = {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  boundingbox?: [string, string, string, string]; // south, north, west, east
};

// Nominatim's policy: at most 1 request per second, and cache what you can.
const cache = new Map<string, Place[]>();
let nextSlot = 0;

async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + 1100;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

/**
 * Search Thai places by name: provinces, districts, roads, sois, landmarks.
 * `near` biases (not limits) results toward where the map is looking.
 */
export async function searchPlaces(q: string, near?: { lat: number; lng: number }): Promise<Place[]> {
  const key = `${q}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const params = new URLSearchParams({
    q,
    format: "jsonv2",
    countrycodes: "th",
    "accept-language": "th",
    limit: "6",
  });
  if (near) {
    const d = 0.5;
    params.set("viewbox", [near.lng - d, near.lat + d, near.lng + d, near.lat - d].join(","));
  }
  await throttle();
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "PeoplesLPR/1.0 (lost licence plate finder)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const hits = (await res.json()) as NominatimHit[];

  const places = hits.map((h): Place => {
    const parts = h.display_name
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && s !== "ประเทศไทย" && !/^\d{5}$/.test(s));
    const name = h.name || parts[0];
    const b = h.boundingbox?.map(Number);
    return {
      name,
      detail: parts.filter((p) => p !== name).join(", "),
      lat: Number(h.lat),
      lng: Number(h.lon),
      bbox: b && b.every(Number.isFinite) ? [b[2], b[0], b[3], b[1]] : null,
    };
  });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  cache.set(key, places);
  return places;
}
