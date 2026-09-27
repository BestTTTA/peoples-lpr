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
