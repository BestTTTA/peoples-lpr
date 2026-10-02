import { type NextRequest, NextResponse } from "next/server";

/**
 * The site answers only on its own domains, and its API only to its own pages.
 *
 * - Pages on any other host (peoples-lpr.roljetson.com, a bare IP…) redirect to
 *   the main domain.
 * - /api/* needs an Origin or Referer from one of our domains: other websites
 *   can't embed our photos or read our data from visitors' browsers, and
 *   header-less direct calls are refused. (A server can still forge these
 *   headers; this keeps honest clients and other sites out, not a determined
 *   scraper.) Refusals are logged with the caller's details.
 * - /api/branding/* (logo, share image) stays open: link-preview crawlers fetch
 *   it directly.
 *
 * ALLOWED_HOSTS (comma separated, Thai or punycode) overrides the default list;
 * the first one is where other hosts are redirected.
 *
 * Development:
 * - `npm run dev` (NODE_ENV=development) skips the API checks entirely, so
 *   curl/Postman work without an Origin.
 * - DEV_ORIGINS (default http://localhost:3000; "" to turn off) are origins a
 *   local front-end may call the live API from: allowed, with CORS headers.
 *   Admin calls still need the admin cookie, which browsers don't send
 *   cross-site (SameSite=Strict): develop the admin page by running this app.
 */

const DEFAULT_HOSTS = "ป้ายทะเบียนหาย.com,paitabianhai.com";

const toAscii = (h: string) => {
  try {
    return new URL(`https://${h.trim()}`).hostname; // Thai -> punycode, lower case
  } catch {
    return "";
  }
};

const PRIMARY = toAscii((process.env.ALLOWED_HOSTS ?? DEFAULT_HOSTS).split(",")[0]);
const ALLOWED = new Set(
  (process.env.ALLOWED_HOSTS ?? DEFAULT_HOSTS)
    .split(",")
    .map(toAscii)
    .filter(Boolean)
    .flatMap((h) => [h, `www.${h}`]),
);

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/;
const DEV = process.env.NODE_ENV !== "production";

const allowedHost = (h: string) => ALLOWED.has(h) || (DEV && LOOPBACK.test(h));

const DEV_ORIGINS = new Set(
  (process.env.DEV_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean),
);

function originOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** CORS for a local front-end calling the live API. */
function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const headers = request.headers;
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(":")[0].toLowerCase();
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");

  // Only Cloudflare-forwarded requests are visitors (the port listens on
  // 127.0.0.1 only, and Cloudflare always adds cf-ray). Anything else is the
  // server itself: the deploy health check, or Next fetching a public file for
  // the image optimizer, which arrives under an internal host name.
  if (!DEV && !headers.get("cf-ray")) return NextResponse.next();

  if (!allowedHost(host)) {
    if (isApi) return refuse(request, host, "host");
    const to = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${PRIMARY}`);
    return NextResponse.redirect(to, 308);
  }

  if (!isApi) return NextResponse.next();
  if (path.startsWith("/api/branding/")) return NextResponse.next();
  if (DEV) return NextResponse.next(); // npm run dev: no API checks

  const origin = headers.get("origin");

  // A local front-end (DEV_ORIGINS) calling the live API: allowed, with CORS.
  const devOrigin = originOf(origin) ?? originOf(headers.get("referer"));
  if (devOrigin && DEV_ORIGINS.has(devOrigin)) {
    const cors = corsHeaders(devOrigin);
    if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: cors });
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
    // Its <img> tags load our photos from another site.
    res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    return res;
  }

  const from = origin ? hostOf(origin) : hostOf(headers.get("referer"));
  if (!from || !allowedHost(from)) return refuse(request, host, origin ? "origin" : from ? "referer" : "no-referer");

  const res = NextResponse.next();
  // Browsers also refuse to show our API responses (photos) inside other sites' pages.
  res.headers.set("Cross-Origin-Resource-Policy", "same-site");
  return res;
}

function refuse(request: NextRequest, host: string, why: string) {
  const h = request.headers;
  console.warn(
    `[api-guard] refused ${request.method} ${request.nextUrl.pathname} (${why}) host=${host} ` +
      `origin=${h.get("origin") ?? "-"} referer=${h.get("referer") ?? "-"} ` +
      `ip=${h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? "-"} ua=${JSON.stringify(h.get("user-agent") ?? "-")}`,
  );
  return NextResponse.json(
    { error: "ไม่อนุญาตให้เรียกใช้ API นี้จากภายนอกเว็บป้ายทะเบียนหาย.com" },
    { status: 403, headers: { "Cross-Origin-Resource-Policy": "same-site" } },
  );
}

export const config = {
  // Everything except Next's own static files and the MapLibre worker.
  matcher: ["/((?!_next/static|_next/image|maplibre/).*)"],
};
