/**
 * Small in-process token bucket per key (client IP). Adequate for a single web
 * instance; on multi-instance deployments move the counters to Redis
 * (REDIS_URL) — the interface stays the same.
 */

interface Bucket {
  tokens: number;
  updatedAt: number;
}

const MAX_BUCKETS = 10_000;
const buckets = new Map<string, Bucket>();

/**
 * Evict only entries that have fully refilled (i.e. are indistinguishable from
 * a fresh bucket). Clearing the whole map instead would let one client that
 * floods enough distinct keys reset everyone else's limits — turning the
 * limiter into a DoS amplifier.
 */
function evictRefilled(capacity: number, refillPerSec: number, now: number): void {
  const fullAfterMs = (capacity / Math.max(refillPerSec, 0.001)) * 1000;
  for (const [k, b] of buckets) {
    if (now - b.updatedAt > fullAfterMs) buckets.delete(k);
    if (buckets.size <= MAX_BUCKETS * 0.9) break;
  }
}

export function rateLimit(
  key: string,
  { capacity = 60, refillPerSec = 1 }: { capacity?: number; refillPerSec?: number } = {}
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) evictRefilled(capacity, refillPerSec, now);

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

/**
 * Identify the caller.
 *
 * `x-forwarded-for` is a client-settable header: its LEFTMOST entry is
 * whatever the original client claimed, so keying on it lets an attacker mint
 * unlimited identities (and evade the limiter entirely) by rotating the value.
 * Platform-set headers are trusted first; otherwise the RIGHTMOST XFF entry is
 * used, since that is the one appended by the nearest trusted proxy.
 */
export function clientKey(req: { headers: Headers }): string {
  const trusted =
    req.headers.get("x-vercel-forwarded-for") ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip");
  if (trusted) return trusted.trim();

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return "local";
}
