/**
 * Hot cache: Redis (Upstash/self-hosted) when REDIS_URL is set, otherwise an
 * in-process TTL map. The in-process fallback is per-process only — with it,
 * cross-process freshness (worker → web) flows through the kv table instead.
 */

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  readonly kind: "redis" | "memory";
}

class MemoryCache implements Cache {
  readonly kind = "memory" as const;
  private store = new Map<string, CacheEntry>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (this.store.size > 5000) this.store.clear(); // crude bound; hot keys refill instantly
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

class RedisCache implements Cache {
  readonly kind = "redis" as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private client: any) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), "EX", Math.max(1, Math.round(ttlSeconds)));
    } catch {
      // Cache write failures must never take down the request path.
    }
  }
}

const globalForCache = globalThis as unknown as { __cybrektCache?: Promise<Cache> };

async function build(): Promise<Cache> {
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      const { default: Redis } = await import("ioredis");
      const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: false });
      client.on("error", () => {
        /* logged by health checks; never crash the process */
      });
      return new RedisCache(client);
    } catch {
      return new MemoryCache();
    }
  }
  return new MemoryCache();
}

export function getCache(): Promise<Cache> {
  if (!globalForCache.__cybrektCache) {
    globalForCache.__cybrektCache = build();
  }
  return globalForCache.__cybrektCache;
}
