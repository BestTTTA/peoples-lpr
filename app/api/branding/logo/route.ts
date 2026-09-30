import { logoBytes } from "@/lib/branding";

// The site logo, also the favicon and home-screen icon (see app/layout.tsx).
// Short cache: a new logo from /admin shows up within minutes.
export async function GET() {
  const data = await logoBytes();
  return new Response(data as Uint8Array<ArrayBuffer>, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" },
  });
}
