import { denyUnlessAdmin } from "@/lib/admin";
import { sanitizeContact } from "@/lib/contact";
import { getContact, saveContact } from "@/lib/contact-settings";

export async function GET() {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  return Response.json(await getContact());
}

export async function PUT(request: Request) {
  const denied = await denyUnlessAdmin();
  if (denied) return denied;
  const contact = sanitizeContact(await request.json().catch(() => null));
  if (!contact) return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  await saveContact(contact);
  return Response.json(contact);
}
