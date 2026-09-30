import { denyUnlessAdmin } from "@/lib/admin";
import { getBranding, resetLogo, setLogo } from "@/lib/branding";

const MAX_BYTES = 3 * 1024 * 1024;
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export async function GET() {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  return Response.json(await getBranding());
}

/** A new logo: the square PNG the admin page's editor produces. */
export async function POST(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size > MAX_BYTES)
    return Response.json({ error: "ไฟล์โลโก้ต้องไม่เกิน 3MB" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  // PNG signature, then IHDR width/height (big-endian at 16 and 20).
  if (bytes.length < 24 || PNG.some((b, i) => bytes[i] !== b))
    return Response.json({ error: "ต้องเป็นไฟล์ PNG" }, { status: 400 });
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const w = view.getUint32(16);
  const h = view.getUint32(20);
  if (w !== h || w < 64 || w > 2048) return Response.json({ error: "โลโก้ต้องเป็นสี่เหลี่ยมจัตุรัส 64–2048 px" }, { status: 400 });
  return Response.json(await setLogo(bytes));
}

/** Back to the built-in logo. */
export async function DELETE() {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  return Response.json(await resetLogo());
}
