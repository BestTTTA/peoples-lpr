export const MAX_SOURCE_URL = 500;

/**
 * The link to the post a plate was first announced in (a Facebook post, say). Only web
 * links are accepted, with or without "https://"; anything else (javascript:, data:)
 * comes back null. "" means none was given.
 */
export function normalizeSourceUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return "";
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(text);
  const looksLikeHost = /^[\w-]+(\.[\w-]+)+(\/|\?|#|$)/.test(text);
  try {
    const url = new URL(hasScheme || !looksLikeHost ? text : `https://${text}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    const out = url.toString();
    return out.length <= MAX_SOURCE_URL ? out : null;
  } catch {
    return null;
  }
}
