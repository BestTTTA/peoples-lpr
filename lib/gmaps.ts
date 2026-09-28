import "server-only";
import { type Place, searchPlaces } from "./geocode";

// Pinning from a Google Maps share link (maps.app.goo.gl/…, google.com/maps/…)
// or from pasted coordinates ("13.7108, 100.7024").

const GOOGLE_HOST = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+|consent\.google\.[a-z.]+)$/;

const inThailandish = (lat: number, lng: number) => lat > 4 && lat < 22 && lng > 96 && lng < 107;
const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** "13.7108, 100.7024" (also with spaces or a slash). */
export function parseCoords(text: string): { lat: number; lng: number } | null {
  const m = text.trim().match(/^(-?\d{1,2}\.\d+)\s*[,/ ]\s*(-?\d{1,3}\.\d+)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return valid(lat, lng) ? { lat, lng } : null;
}

export function isGoogleMapsUrl(text: string): boolean {
  try {
    const u = new URL(text.trim());
    return /^https?:$/.test(u.protocol) && GOOGLE_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

/** Follow a short link to the full maps URL, only ever through Google hosts. */
async function expand(link: string): Promise<URL> {
  let url = new URL(link.trim());
  for (let hop = 0; hop < 5; hop++) {
    if (!GOOGLE_HOST.test(url.hostname)) throw new Error(`not a Google host: ${url.hostname}`);
    // The cookie-consent interstitial carries the real target in ?continue=.
    const next = url.hostname.startsWith("consent.") ? url.searchParams.get("continue") : null;
    if (next) {
      url = new URL(next);
      continue;
    }
    const short = /^(maps\.app\.goo\.gl|goo\.gl|g\.co)$/.test(url.hostname);
    if (!short) return url; // already a full maps URL
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    const loc = res.headers.get("location");
    if (!loc) return url;
    url = new URL(loc, url);
  }
  return url;
}

function coordsFrom(url: URL): { lat: number; lng: number; exact: boolean } | null {
  const s = decodeURIComponent(url.href);
  // The place itself: …!3d13.710863!4d100.7024131 (take the last pair).
  const place = [...s.matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g)].at(-1);
  if (place) return { lat: Number(place[1]), lng: Number(place[2]), exact: true };
  // ?q=13.7,100.7 / ?query= / ?ll= / ?destination= / ?center=
  for (const k of ["q", "query", "ll", "destination", "center", "daddr"]) {
    const c = parseCoords(url.searchParams.get(k) ?? "");
    if (c) return { ...c, exact: true };
  }
  // /maps/place/13.7,100.7 or /maps/search/13.7,+100.7
  const inPath = url.pathname.match(/\/(?:place|search|dir)\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (inPath) return { lat: Number(inPath[1]), lng: Number(inPath[2]), exact: true };
  // Last resort: where the map was looking, @13.72,100.69,14z.
  const view = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (view) return { lat: Number(view[1]), lng: Number(view[2]), exact: false };
  return null;
}

function placeName(url: URL): string {
  const seg = url.pathname.match(/\/place\/([^/]+)/)?.[1] ?? url.searchParams.get("q") ?? "";
  return decodeURIComponent(seg.replace(/\+/g, " ")).trim();
}

/** A Google Maps link to one Place, or null when it holds no usable location. */
export async function resolveGoogleMaps(link: string): Promise<Place | null> {
  const url = await expand(link);
  const name = placeName(url);
  const c = coordsFrom(url);
  if (c && valid(c.lat, c.lng)) {
    return {
      name: name && !parseCoords(name) ? name : "ตำแหน่งจาก Google Maps",
      detail: `จาก Google Maps · ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}${
        c.exact ? "" : " (กึ่งกลางแผนที่ ควรเลื่อนหมุดให้ตรง)"
      }${inThailandish(c.lat, c.lng) ? "" : " · อยู่นอกประเทศไทย"}`,
      lat: c.lat,
      lng: c.lng,
      bbox: null,
    };
  }
  // A link with only a name (e.g. ?q=ร้าน…): look the name up instead.
  if (name) return (await searchPlaces(name))[0] ?? null;
  return null;
}
