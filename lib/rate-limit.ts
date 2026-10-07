import "server-only";

type Bucket = { count: number; resetAt: number };

const globalBuckets = globalThis as unknown as { lprRateLimits?: Map<string, Bucket> };
const buckets = (globalBuckets.lprRateLimits ??= new Map());

/** Small, process-local abuse guard. Production currently runs as one web container. */
export function allowRequest(request: Request, scope: string, limit: number, windowMs: number): boolean {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 2_000)
      for (const [k, value] of buckets) if (value.resetAt <= now) buckets.delete(k);
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
