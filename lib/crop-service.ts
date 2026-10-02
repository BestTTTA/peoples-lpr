import "server-only";

// The plate detector (crop-service/). Admin calls carry the shared token.
// Forgiving about how the base was written in .env: trailing slash, or the /crops path.
export const CROP_BASE = (process.env.CROP_API_URL ?? "http://plate-crop:8000")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/crops$/, "");

export function cropFetch(path: string, init: RequestInit & { admin?: boolean } = {}) {
  const { admin, headers, ...rest } = init;
  return fetch(`${CROP_BASE}${path}`, {
    ...rest,
    headers: {
      ...(headers as Record<string, string>),
      ...(admin ? { "X-Admin-Token": process.env.CROP_ADMIN_TOKEN ?? "" } : {}),
    },
  });
}

/** Pass a crop-service JSON reply through, turning its {detail} errors into {error}. */
export async function relay(res: Response): Promise<Response> {
  const data = (await res.json().catch(() => ({}))) as { detail?: unknown };
  if (res.ok) return Response.json(data);
  const detail = typeof data.detail === "string" ? data.detail : `crop service ${res.status}`;
  return Response.json({ error: detail }, { status: res.status >= 500 ? 502 : res.status });
}
