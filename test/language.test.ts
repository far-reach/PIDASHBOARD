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
