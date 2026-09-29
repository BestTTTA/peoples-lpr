import { getContact } from "@/lib/contact-settings";

// Public: the site's contact channels, as set on /admin.
export async function GET() {
  return Response.json(await getContact(), { headers: { "Cache-Control": "public, max-age=60" } });
}
