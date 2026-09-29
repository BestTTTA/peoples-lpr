import { clean, isValidNumber, isValidPrefix } from "./plate";
import { filterProvinces, isProvince } from "./provinces";

// Thai, readable URLs. next.config.ts maps them onto the ASCII routes; keep the
// path words there in step with these.

export const REPORT_PATH = "/แจ้งพบป้าย";
export const FOUND_PATH = "/ป้ายที่พบ";

/** /ค้นหา/3ฒน-5702-กรุงเทพมหานคร, or /ค้นหา/3ฒน-5702 for any province */
export function searchPath(prefix: string, number: string, province: string): string {
  return `/ค้นหา/${clean(prefix)}-${clean(number)}${province ? `-${province}` : ""}`;
}

/** /จุดพบ/<report id> */
export function reportPath(id: string): string {
  return `/จุดพบ/${id}`;
}

/** For history.pushState and friends, which want an encoded URL. */
export const href = (path: string) => encodeURI(path);

export type PlateQuery = { prefix: string; number: string; province: string };

/** Read "3ฒน-5702-กรุงเทพมหานคร" ("3ฒน-5702-กทม", or "3ฒน-5702" for any province) back into a search. */
export function parsePlateSlug(slug: string | undefined): PlateQuery | null {
  if (!slug) return null;
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {}
  const [prefix, number, ...rest] = s.trim().split("-");
  const place = rest.join("-").trim();
  if (!prefix || !number) return null;
  let province = "";
  if (place) {
    const aliasHit = filterProvinces(place);
    province = isProvince(place) ? place : aliasHit.length === 1 ? aliasHit[0] : "";
    if (!province) return null;
  }
  if (!isValidPrefix(prefix) || !isValidNumber(number)) return null;
  return { prefix: clean(prefix), number: clean(number), province };
}
