// The site's own contact channels ("ติดต่อเรา"), edited on /admin, shown on
// every page. Shared by the browser and the API.

/** Each type's name, brand colour (icon disc) and input hint. */
export const CHANNEL_TYPES = {
  line: { label: "LINE", color: "#06C755", placeholder: "เช่น @peopleslpr หรือลิงก์ line.me" },
  facebook: { label: "Facebook", color: "#1877F2", placeholder: "ชื่อเพจ หรือลิงก์ facebook.com/…" },
  phone: { label: "โทรศัพท์", color: "#2f8fe6", placeholder: "เช่น 02-123-4567" },
  email: { label: "อีเมล", color: "#EA4335", placeholder: "เช่น contact@example.com" },
  instagram: { label: "Instagram", color: "#E4405F", placeholder: "ชื่อบัญชี หรือลิงก์ instagram.com/…" },
  tiktok: { label: "TikTok", color: "#111111", placeholder: "เช่น @ชื่อบัญชี หรือลิงก์ tiktok.com/…" },
  youtube: { label: "YouTube", color: "#FF0000", placeholder: "เช่น @ช่อง หรือลิงก์ youtube.com/…" },
  x: { label: "X", color: "#000000", placeholder: "ชื่อบัญชี หรือลิงก์ x.com/…" },
  website: { label: "เว็บไซต์", color: "#0EA5A4", placeholder: "เช่น example.com" },
  other: { label: "อื่น ๆ", color: "#6B7280", placeholder: "ข้อความที่จะแสดง" },
} as const;

export type ChannelType = keyof typeof CHANNEL_TYPES;
export type Channel = { type: ChannelType; label: string; value: string };
export type ContactInfo = { heading: string; note: string; channels: Channel[] };

export const EMPTY_CONTACT: ContactInfo = { heading: "ติดต่อเรา", note: "", channels: [] };
export const MAX_CHANNELS = 10;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function sanitizeContact(input: unknown): ContactInfo | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (!Array.isArray(o.channels)) return null;
  const channels: Channel[] = [];
  for (const c of o.channels.slice(0, MAX_CHANNELS)) {
    if (!c || typeof c !== "object") return null;
    const { type, label, value } = c as Record<string, unknown>;
    if (typeof type !== "string" || !(type in CHANNEL_TYPES)) return null;
    const v = text(value, 200);
    if (!v) continue; // an empty row is just dropped
    channels.push({ type: type as ChannelType, label: text(label, 60), value: v });
  }
  return { heading: text(o.heading, 60) || EMPTY_CONTACT.heading, note: text(o.note, 300), channels };
}

const httpsUrl = (v: string): string | null => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
};

/**
 * Where a channel links to. Only tel:, mailto: and http(s) come out of here,
 * whatever an admin typed, so a channel can never become a javascript: link.
 */
export function channelHref({ type, value }: Channel): string | null {
  const v = value.trim();
  switch (type) {
    case "phone": {
      const digits = v.replace(/[^\d+]/g, "");
      return digits.length >= 3 ? `tel:${digits}` : null;
    }
    case "email":
      return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v) ? `mailto:${v}` : null;
    case "line":
      if (/^https?:\/\//i.test(v)) return httpsUrl(v);
      // "@abc" is an official account, anything else a personal LINE ID.
      return v.startsWith("@")
        ? `https://line.me/R/ti/p/${encodeURIComponent(v)}`
        : `https://line.me/ti/p/~${encodeURIComponent(v)}`;
    case "facebook":
      if (/^https?:\/\//i.test(v)) return httpsUrl(v);
      return `https://www.facebook.com/${encodeURIComponent(v.replace(/^@/, ""))}`;
    case "instagram":
    case "x":
      if (/^https?:\/\//i.test(v)) return httpsUrl(v);
      return `https://${type === "x" ? "x.com" : "www.instagram.com"}/${encodeURIComponent(v.replace(/^@/, ""))}`;
    case "tiktok":
    case "youtube":
      if (/^https?:\/\//i.test(v)) return httpsUrl(v);
      return `https://www.${type}.com/@${encodeURIComponent(v.replace(/^@/, ""))}`;
    case "website":
      return httpsUrl(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    default:
      return null;
  }
}

/**
 * The short text under a channel's name: a handle, number, address or domain,
 * never a full URL ("facebook.com/x?locale=th_TH" reads as "@x").
 */
export function channelDisplay({ type, value }: Channel): string {
  const v = value.trim();
  if (type === "phone" || type === "email" || type === "other") return v;
  let url: URL | null = null;
  try {
    url = /^https?:\/\//i.test(v) ? new URL(v) : null;
  } catch {}
  if (!url) return type === "website" ? v.replace(/\/.*$/, "") : v.startsWith("@") ? v : `@${v}`;
  if (type === "website") return url.hostname.replace(/^www\./, "");
  // The first path part is the account for these sites (line.me/R/ti/p/@id aside).
  const parts = decodeURIComponent(url.pathname).split("/").filter(Boolean);
  const handle = type === "line" ? parts.find((p) => p.startsWith("@") || p.startsWith("~")) : parts[0];
  if (!handle || /^(profile\.php|people|pages|groups|channel|c|user)$/i.test(handle))
    return url.hostname.replace(/^www\./, "");
  return handle.startsWith("@") ? handle : `@${handle.replace(/^~/, "")}`;
}
