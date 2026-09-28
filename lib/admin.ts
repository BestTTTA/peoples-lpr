import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// Admin sign-in for /admin: one shared password (ADMIN_PASSWORD), and a signed,
// expiring cookie. Changing the password signs everyone out.

const COOKIE = "lpr_admin";
const TTL_S = 12 * 60 * 60;

const password = () => process.env.ADMIN_PASSWORD ?? "";
export const adminEnabled = () => password().length >= 8;

const key = () => createHash("sha256").update(`peoples-lpr-admin:${password()}`).digest();
const sign = (exp: number) => createHmac("sha256", key()).update(String(exp)).digest("base64url");

function sameBytes(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(attempt: string): boolean {
  if (!adminEnabled()) return false;
  // Hash both so the comparison is constant-time whatever the lengths.
  const h = (s: string) => createHash("sha256").update(s).digest();
  return sameBytes(h(attempt), h(password()));
}

export async function isAdmin(): Promise<boolean> {
  if (!adminEnabled()) return false;
  const value = (await cookies()).get(COOKIE)?.value ?? "";
  const [expStr, sig] = value.split(".");
  const exp = Number(expStr);
  if (!sig || !Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  return sameBytes(Buffer.from(sig), Buffer.from(sign(exp)));
}

export async function startSession(): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + TTL_S;
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TTL_S,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** For admin API routes: a 401 response unless signed in. */
export async function denyUnlessAdmin(): Promise<Response | null> {
  return (await isAdmin()) ? null : Response.json({ error: "กรุณาเข้าสู่ระบบผู้ดูแล" }, { status: 401 });
}
