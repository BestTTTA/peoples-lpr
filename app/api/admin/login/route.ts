import { adminEnabled, checkPassword, endSession, startSession } from "@/lib/admin";

// Slows password guessing: every failure costs the caller a second.
const FAIL_DELAY_MS = 1000;

export async function POST(request: Request) {
  if (!adminEnabled()) return Response.json({ error: "ยังไม่ได้ตั้ง ADMIN_PASSWORD บนเซิร์ฟเวอร์" }, { status: 503 });
  const { password } = (await request.json().catch(() => ({}))) as { password?: unknown };
  if (typeof password !== "string" || !checkPassword(password)) {
    await new Promise((r) => setTimeout(r, FAIL_DELAY_MS));
    return Response.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  await startSession();
  return Response.json({ ok: true });
}

export async function DELETE() {
  await endSession();
  return Response.json({ ok: true });
}
