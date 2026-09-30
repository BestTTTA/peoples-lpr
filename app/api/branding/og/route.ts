import { ogBytes } from "@/lib/branding";

// The link-share preview image (Open Graph / Twitter), 1200x630. Its URL in the
// page tags carries a version, so a new image is a new URL for crawlers.
export async function GET() {
  return new Response((await ogBytes()) as Uint8Array<ArrayBuffer>, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=300" },
  });
}
