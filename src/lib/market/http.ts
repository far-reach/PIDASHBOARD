/**
 * Reject a price that is not a sane positive number.
 *
 * Exchanges return "0", "" or null for a delisted, halted or unknown
 * instrument, and `Number("")` is 0. A zero propagating into the feed would
 * stop out every open long at price 0 and destroy the published record, so
 * every client validates before a tick leaves it. Throwing here is precisely
 * what makes the aggregator fail over to the next venue.
 */
export function requirePrice(value: unknown, context: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${context}: implausible price ${JSON.stringify(value)}`);
  }
  return n;
}

/** Optional positive numeric field: null rather than throwing when absent. */
export function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** fetch with a hard timeout; exchange APIs must never hang a request path. */
export async function fetchJson<T>(url: string, timeoutMs = 4000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
