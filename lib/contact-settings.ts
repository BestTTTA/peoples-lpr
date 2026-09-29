import "server-only";
import { type ContactInfo, EMPTY_CONTACT, sanitizeContact } from "./contact";
import { getSetting, setSetting } from "./store";

const KEY = "contact";
let cached: { at: number; value: ContactInfo } | null = null;
const TTL = 30_000;

export async function getContact(): Promise<ContactInfo> {
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  const value = sanitizeContact(await getSetting(KEY).catch(() => null)) ?? EMPTY_CONTACT;
  cached = { at: Date.now(), value };
  return value;
}

export async function saveContact(value: ContactInfo): Promise<void> {
  await setSetting(KEY, value);
  cached = { at: Date.now(), value };
}
