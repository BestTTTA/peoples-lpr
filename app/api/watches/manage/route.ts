import { createHash } from "node:crypto";
import { clean, isValidNumber, isValidPrefix } from "@/lib/plate";
import { isProvince } from "@/lib/provinces";
import { allowRequest } from "@/lib/rate-limit";
import { cancelManagedWatch, getManagedWatch, updateManagedWatch, type WatchInput } from "@/lib/store";

const MAX_NAME = 60;
const MAX_PHONE = 40;

function bad(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

function cleanPhone(raw: string): string {
  const value = raw.trim();
  return (value.startsWith("+") ? "+" : "") + value.replace(/\D/g, "");
}

function parseBody(body: unknown): { lookup: Pick<WatchInput, "prefix" | "number" | "province">; codeHash: string } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const prefix = clean(String(b.prefix ?? ""));
  const number = clean(String(b.number ?? ""));
  const province = String(b.province ?? "");
  const code = String(b.managementCode ?? "").trim();
  if (!isValidPrefix(prefix) || !isValidNumber(number) || !isProvince(province) || !/^\d{6}$/.test(code)) return null;
  return { lookup: { prefix, number, province }, codeHash: sha256(code) };
}

function parseInput(body: Record<string, unknown>): WatchInput | null {
  const name = String(body.name ?? "").trim().slice(0, MAX_NAME);
  const phone = cleanPhone(String(body.phone ?? "")).slice(0, MAX_PHONE);
  const prefix = clean(String(body.newPrefix ?? ""));
  const number = clean(String(body.newNumber ?? ""));
  const province = String(body.newProvince ?? "");
  if (!name || phone.replace(/\D/g, "").length < 9) return null;
  if (!isValidPrefix(prefix) || !isValidNumber(number) || !isProvince(province)) return null;
  return { name, phone, prefix, number, province };
}

async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

function limited(request: Request): Response | null {
  return allowRequest(request, "watch-manage", 12, 10 * 60_000)
    ? null
    : bad("ลองรหัสหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่", 429);
}

export async function POST(request: Request) {
  const rateLimited = limited(request);
  if (rateLimited) return rateLimited;
  const parsed = parseBody(await readJson(request));
  if (!parsed) return bad("ข้อมูลป้ายหรือรหัสจัดการไม่ถูกต้อง");
  try {
    const watch = await getManagedWatch(parsed.lookup, parsed.codeHash);
    if (!watch) return bad("ไม่พบรายการ หรือรหัสจัดการไม่ถูกต้อง", 404);
    return Response.json({ watch });
  } catch (err) {
    console.error("get managed watch", err);
    return bad("ตรวจสอบรายการไม่สำเร็จ กรุณาลองใหม่", 500);
  }
}

export async function PATCH(request: Request) {
  const rateLimited = limited(request);
  if (rateLimited) return rateLimited;
  const body = await readJson(request);
  const parsed = parseBody(body);
  const input = body && typeof body === "object" ? parseInput(body as Record<string, unknown>) : null;
  if (!parsed || !input) return bad("กรุณาตรวจสอบข้อมูลที่แก้ไข");
  try {
    const watch = await updateManagedWatch(parsed.lookup, parsed.codeHash, input);
    if (!watch) return bad("ไม่พบรายการ หรือรหัสจัดการไม่ถูกต้อง", 404);
    return Response.json({ watch });
  } catch (err) {
    console.error("update managed watch", err);
    return bad("บันทึกการแก้ไขไม่สำเร็จ กรุณาลองใหม่", 500);
  }
}

export async function DELETE(request: Request) {
  const rateLimited = limited(request);
  if (rateLimited) return rateLimited;
  const parsed = parseBody(await readJson(request));
  if (!parsed) return bad("ข้อมูลป้ายหรือรหัสจัดการไม่ถูกต้อง");
  try {
    const cancelled = await cancelManagedWatch(parsed.lookup, parsed.codeHash);
    if (!cancelled) return bad("ไม่พบรายการ หรือรหัสจัดการไม่ถูกต้อง", 404);
    return Response.json({ cancelled: true });
  } catch (err) {
    console.error("cancel managed watch", err);
    return bad("ยกเลิกรายการไม่สำเร็จ กรุณาลองใหม่", 500);
  }
}
