import { denyUnlessAdmin } from "@/lib/admin";
import { OG_DEFAULTS, getBranding, resetOgImage, setOgImage, setOgText } from "@/lib/branding";

const MAX_BYTES = 5 * 1024 * 1024;

export async function GET() {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  return Response.json({ ...(await getBranding()), defaults: OG_DEFAULTS });
}

/** A new share image: the 1200x630 JPEG the admin page's editor produces. */
export async function POST(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size > MAX_BYTES)
    return Response.json({ error: "รูปต้องไม่เกิน 5MB" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return Response.json({ error: "ต้องเป็นไฟล์ JPEG" }, { status: 400 });
  return Response.json(await setOgImage(bytes));
}

/** Share title, description and image alt text. Empty = back to the default. */
export async function PUT(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const text = (k: string, max: number) => (typeof body?.[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  if (!body) return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  return Response.json(
    await setOgText({ ogTitle: text("ogTitle", 120), ogDescription: text("ogDescription", 300), ogAlt: text("ogAlt", 300) }),
  );
}

/** Back to the built-in share image. */
export async function DELETE() {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  return Response.json(await resetOgImage());
}
