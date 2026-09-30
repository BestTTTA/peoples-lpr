import "server-only";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getFile, getSetting, removeFile, saveFile, setSetting } from "./store";

// The site logo (header, favicon, home-screen icon). An admin can replace it on
// /admin; until then it is public/brand-logo.png.

type Branding = { logo: string | null; updatedAt: string | null };

const KEY = "branding";
const DEFAULT_LOGO = path.join(process.cwd(), "public", "brand-logo.png");
let cached: { at: number; value: Branding } | null = null;
const TTL = 30_000;

export async function getBranding(): Promise<Branding> {
  if (cached && Date.now() - cached.at < TTL) return cached.value;
  const saved = await getSetting<Branding>(KEY).catch(() => null);
  const value = { logo: saved?.logo ?? null, updatedAt: saved?.updatedAt ?? null };
  cached = { at: Date.now(), value };
  return value;
}

/** PNG bytes of the current logo, and whether it is the built-in one. */
export async function logoBytes(): Promise<{ data: Uint8Array; builtIn: boolean }> {
  const { logo } = await getBranding();
  if (logo) {
    const data = await getFile(logo).catch(() => null);
    if (data) return { data, builtIn: false };
  }
  return { data: await readFile(DEFAULT_LOGO), builtIn: true };
}

async function save(value: Branding, old: string | null) {
  await setSetting(KEY, value);
  cached = { at: Date.now(), value };
  if (old && old !== value.logo) await removeFile(old).catch((err) => console.error("remove old logo", err));
}

export async function setLogo(png: Uint8Array): Promise<Branding> {
  const old = (await getBranding()).logo;
  const name = `branding-logo-${randomUUID()}.png`;
  await saveFile(name, png, "image/png");
  const value = { logo: name, updatedAt: new Date().toISOString() };
  await save(value, old);
  return value;
}

export async function resetLogo(): Promise<Branding> {
  const old = (await getBranding()).logo;
  const value = { logo: null, updatedAt: new Date().toISOString() };
  await save(value, old);
  return value;
}
