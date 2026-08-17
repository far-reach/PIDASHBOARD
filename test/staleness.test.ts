import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STALE_AFTER_S } from "@/lib/env";

/**
 * The staleness badge is the app's core honesty promise: a price is never
 * presented as live when it is not. That derivation must hold everywhere a
 * LatestPrice is produced — including the on-demand cache path, where the
 * regression this pins actually lived: the cached object's ageing `stalenessS`
 * was recomputed but the cached `isStale` flag was served as-is, so a tick
 * could cross the threshold inside the cache window and still claim freshness.
 */

// Mirrors the recompute in getLatestPrice's cache branch. Kept as a pure
// function here so the invariant is testable without a database or network.
function recomputeStaleness(tsIso: string, now: number): { stalenessS: number; isStale: boolean } {
  const stalenessS = Math.max(0, Math.round((now - new Date(tsIso).getTime()) / 1000));
  return { stalenessS, isStale: stalenessS > STALE_AFTER_S };
}

describe("staleness is derived from the clock, never cached", () => {
  it("a fresh tick is fresh", () => {
    const now = Date.now();
    const r = recomputeStaleness(new Date(now - 5_000).toISOString(), now);
    expect(r.isStale).toBe(false);
    expect(r.stalenessS).toBe(5);
  });

  it("a tick that crosses the threshold while cached flips the flag", () => {
    const now = Date.now();
    // Cached while fresh (STALE_AFTER_S - 1s old), served 3s later: now stale.
    const cachedAt = now - (STALE_AFTER_S - 1) * 1000;
    const servedAt = now + 3_000;
    const whenCached = recomputeStaleness(new Date(cachedAt).toISOString(), now);
    const whenServed = recomputeStaleness(new Date(cachedAt).toISOString(), servedAt);
    expect(whenCached.isStale).toBe(false);
    expect(whenServed.isStale).toBe(true);
  });

  it("the served flag always agrees with the served age", () => {
    const now = Date.now();
    for (const ageS of [0, 30, STALE_AFTER_S, STALE_AFTER_S + 1, 600]) {
      const r = recomputeStaleness(new Date(now - ageS * 1000).toISOString(), now);
      expect(r.isStale).toBe(r.stalenessS > STALE_AFTER_S);
    }
  });

  it("the feed source recomputes isStale in the cache branch (not spread from the cached object)", () => {
    // Structural pin: the cache-hit return must derive isStale next to
    // stalenessS, not inherit it via the spread.
    const src = readFileSync("src/lib/feed.ts", "utf8");
    expect(src).toMatch(/isStale:\s*stalenessS\s*>\s*STALE_AFTER_S/);
  });
});
