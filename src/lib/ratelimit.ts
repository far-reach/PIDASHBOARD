/**
 * Small in-process token bucket per key (IP). Adequate for a single web
 * instance; on multi-instance deployments move the counters to Redis
 * (REDIS_URL) — the interface stays the same.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  { capacity = 60, refillPerSec = 1 }: { capacity?: number; refillPerSec?: number } = {}
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  if (buckets.size > 10_000) buckets.clear();
  const b = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
  const elapsed = (now - b.updatedAt) / 1000;
  b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSec);
  b.updatedAt = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return { allowed: false, remaining: 0 };
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return { allowed: true, remaining: Math.floor(b.tokens) };
}

export function clientKey(req: { headers: Headers }): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0]!.trim() : "local";
}
