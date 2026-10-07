import { createHash } from "node:crypto";
import { allowRequest } from "@/lib/rate-limit";
import { listActiveOwnedWatchIds } from "@/lib/store";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{32}$/;
const MAX_ENTRIES = 20;

export async function POST(request: Request) {
  if (!allowRequest(request, "watch-status", 30, 60 * 60_000))
    return Response.json({ error: "ตรวจสอบสถานะถี่เกินไป กรุณารอสักครู่" }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { entries?: unknown } | null;
  if (!Array.isArray(body?.entries) || body.entries.length > MAX_ENTRIES)
    return Response.json({ error: "ข้อมูลรายการไม่ถูกต้อง" }, { status: 400 });

  const entries: { id: string; tokenHash: string }[] = [];
  for (const raw of body.entries) {
    if (!raw || typeof raw !== "object") return Response.json({ error: "ข้อมูลรายการไม่ถูกต้อง" }, { status: 400 });
    const item = raw as Record<string, unknown>;
    const id = String(item.id ?? "");
    const token = String(item.token ?? "");
    if (!UUID.test(id) || !TOKEN.test(token)) return Response.json({ error: "ข้อมูลรายการไม่ถูกต้อง" }, { status: 400 });
    entries.push({ id, tokenHash: createHash("sha256").update(token).digest("hex") });
  }

  try {
    return Response.json({ activeIds: await listActiveOwnedWatchIds(entries) });
  } catch (err) {
    console.error("sync owned watches", err);
    return Response.json({ error: "ตรวจสอบสถานะรายการไม่สำเร็จ" }, { status: 500 });
  }
}
