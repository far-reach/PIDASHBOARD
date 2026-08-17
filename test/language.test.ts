import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Brief §3.3/§8: financial-advice language is forbidden everywhere users
 * read. This test scans every UI source file and the report generator for
 * the forbidden phrases so a regression fails CI, not a regulator.
 */
const FORBIDDEN: RegExp[] = [
  /guaranteed (profit|return|gain|win)/i,
  /risk[- ]free/i,
  /you should (buy|sell|long|short)/i,
  /\bcan'?t lose\b/i,
  /\bsure thing\b/i,
  /\bto the moon\b/i,
  /\bwill (pump|moon|explode|10x)\b/i,

  // Pi ecosystem guidelines prohibit "material discussions, representations or
  // misrepresentations regarding the value or valuation of Pi". Asserting or
  // forecasting what Pi is worth is the exact shape of claim that gets an app
  // pulled — and repeat offences reach the developer's account, not just the
  // app. These patterns keep that class of copy out of the product.
  /\bprice (prediction|forecast|target)s?\b/i,
  /\b(pi|π) (is|will be) worth\b/i,
  /\b(fair|true|real|global consensus) value of (pi|π)\b/i,
  /\bwe (predict|forecast|expect) (pi|π|the price)\b/i,
  /\bgcv\b/i,
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|md)$/.test(name)) out.push(p);
  }
  return out;
}

describe("copy style: text reads as human-written", () => {
  // Operator rule (2026-08-17, permanent): no em-dashes anywhere users read.
  // The " — " construction is a tell of machine-written prose; sentences are
  // reworded with a period, comma, colon or parenthesis instead. Enforced as
  // a bright line over the whole user-facing tree, comments included, so it
  // cannot creep back through any future edit.
  const files = [...walk("src/app"), ...walk("src/components"), ...walk("src/lib/reports")];

  it("no em-dash characters anywhere in user-facing sources", () => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes("—"));
    expect(offenders).toEqual([]);
  });
});

describe("no financial-advice language in user-facing sources", () => {
  const files = [...walk("src/app"), ...walk("src/components"), ...walk("src/lib/reports")];

  it("scans a meaningful set of files", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  for (const pattern of FORBIDDEN) {
    it(`no match for ${pattern}`, () => {
      const offenders = files.filter((f) => pattern.test(readFileSync(f, "utf8")));
      expect(offenders).toEqual([]);
    });
  }
});
