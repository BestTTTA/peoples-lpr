import "server-only";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getFile, getSetting, removeFile, saveFile, setSetting } from "./store";

// Site branding an admin can change on /admin: the logo (header, favicon,
// home-screen icon) and the link-share preview (Open Graph image and text).
// Until changed, the built-in files in public/ and the texts below are used.

export const OG_DEFAULTS = {
  ogTitle: "เจอป้ายทะเบียนรถ? แจ้งพบได้ที่นี่ — ป้ายทะเบียนหาย.com",
  ogDescription: "ป้ายทะเบียนหาย.com (Peoples LPR): แจ้งพบและค้นหาป้ายทะเบียนรถที่หาย พร้อมตำแหน่งบนแผนที่",
  ogAlt: "เจอป้ายทะเบียนรถ? แจ้งพบได้ที่นี่ ใช้ฟรี ช่วยส่งต่อให้เจ้าของตามกลับได้ — ป้ายทะเบียนหาย.com",
};

export type Branding = {
  logo: string | null;
  updatedAt: string | null;
  ogImage: string | null;
  ogTitle: string;
  ogDescription: string;
  ogAlt: string;
  /** Changes whenever the share image changes: part of its URL, so crawlers fetch the new one. */
  ogVersion: string;
};

const KEY = "branding";
const DEFAULT_LOGO = path.join(process.cwd(), "public", "brand-logo.png");
const DEFAULT_OG = path.join(process.cwd(), "public", "og-default.jpg");
let cached: { at: number; value: Branding } | null = null;
const TTL = 30_000;

export async function getBranding(): Promise<Branding> {
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  const saved = (await getSetting<Partial<Branding>>(KEY).catch(() => null)) ?? {};
  const value: Branding = {
    logo: saved.logo ?? null,
    updatedAt: saved.updatedAt ?? null,
    ogImage: saved.ogImage ?? null,
    ogTitle: saved.ogTitle || OG_DEFAULTS.ogTitle,
    ogDescription: saved.ogDescription || OG_DEFAULTS.ogDescription,
    ogAlt: saved.ogAlt || OG_DEFAULTS.ogAlt,
    ogVersion: saved.ogVersion ?? "default",
  };
  cached = { at: Date.now(), value };
  return value;
}

async function save(patch: Partial<Branding>, drop?: string | null) {
  const value = { ...(await getBranding()), ...patch };
  await setSetting(KEY, value);
  cached = { at: Date.now(), value };
  if (drop) await removeFile(drop).catch((err) => console.error("remove old branding file", err));
  return value;
}

async function stored(name: string | null, fallback: string) {
  if (name) {
    const data = await getFile(name).catch(() => null);
    if (data) return data;
  }
  return new Uint8Array(await readFile(fallback));
}

/** PNG bytes of the current logo. */
export async function logoBytes(): Promise<Uint8Array> {
  return stored((await getBranding()).logo, DEFAULT_LOGO);
}

/** JPEG bytes of the current share image. */
export async function ogBytes(): Promise<Uint8Array> {
  return stored((await getBranding()).ogImage, DEFAULT_OG);
}

export async function setLogo(png: Uint8Array): Promise<Branding> {
  const old = (await getBranding()).logo;
  const name = `branding-logo-${randomUUID()}.png`;
  await saveFile(name, png, "image/png");
  return save({ logo: name, updatedAt: new Date().toISOString() }, old);
}

export async function resetLogo(): Promise<Branding> {
  return save({ logo: null, updatedAt: new Date().toISOString() }, (await getBranding()).logo);
}

export async function setOgImage(jpeg: Uint8Array): Promise<Branding> {
  const old = (await getBranding()).ogImage;
  const name = `branding-og-${randomUUID()}.jpg`;
  await saveFile(name, jpeg, "image/jpeg");
  return save({ ogImage: name, ogVersion: randomUUID().slice(0, 8) }, old);
}

export async function resetOgImage(): Promise<Branding> {
  return save({ ogImage: null, ogVersion: randomUUID().slice(0, 8) }, (await getBranding()).ogImage);
}

export async function setOgText(text: { ogTitle: string; ogDescription: string; ogAlt: string }): Promise<Branding> {
  return save(text);
}
