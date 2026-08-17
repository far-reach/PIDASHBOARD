import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Pi ecosystem compliance, pinned as tests.
 *
 * These encode decisions that are cheap to undo by accident and expensive to
 * undo in production: an app removed from the ecosystem, and — for repeat
 * offences — penalties reaching the developer's account. A reviewer will not
 * catch a one-line default flip in a config file. CI will.
 */

describe("directional trading calls are off by default", () => {
  it("SIGNALS_ENABLED requires an explicit opt-in, and is not on by default", async () => {
    // Imported fresh with no env set: the default must be off.
    delete process.env.NEXT_PUBLIC_SIGNALS_ENABLED;
    vi.resetModules();
    const env = await import("@/lib/env");
    expect(env.SIGNALS_ENABLED).toBe(false);
  });

  it("the switch is opt-in by exact string, so a typo fails closed", () => {
    const src = readFileSync("src/lib/env.ts", "utf8");
    // `=== "true"` and nothing looser: "1", "yes" or "TRUE" must not enable it.
    expect(src).toMatch(/SIGNALS_ENABLED\s*=\s*process\.env\.NEXT_PUBLIC_SIGNALS_ENABLED\s*===\s*"true"/);
  });

  it("the subscription cannot be sold when there are no signals to gate", () => {
    const src = readFileSync("src/lib/env.ts", "utf8");
    expect(src).toMatch(/if \(!SIGNALS_ENABLED\) return "free"/);
  });
});

describe("the gate is enforced on the server, not only in the navigation", () => {
  const routes = [
    "src/app/api/signals/route.ts",
    "src/app/api/performance/route.ts",
    "src/app/api/signals/[id]/route.ts",
  ];

  for (const route of routes) {
    it(`${route} checks the gate before serving signal data`, () => {
      expect(readFileSync(route, "utf8")).toMatch(/signalsReadDisabled\(\)/);
    });
  }

  it("publishing a new signal is blocked outright while disabled", () => {
    const src = readFileSync("src/app/api/signals/route.ts", "utf8");
    expect(src).toMatch(/signalsWriteBlocked\(\)/);
  });
});

describe("Pi trademark and naming rules", () => {
  /**
   * Pi's trademark guidelines: an app name may NOT take the form "Pi App_Name"
   * — it implies Pi Core Team authorship. Permitted forms are "App_Name for Pi"
   * / "App_Name on Pi", and only under an executed trademark licence.
   *
   * This checks the app's OWN declared name. It deliberately does not scan for
   * any "Pi<Word>" token, because referring to Pi's own products (PiNet, Pi
   * Browser) is legitimate and expected.
   */
  const prohibitedForm = /^Pi[A-Z]/;

  it("the manifest name and short_name are not in the 'Pi<Name>' form", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as {
      name: string;
      short_name: string;
    };
    expect(manifest.name).not.toMatch(prohibitedForm);
    expect(manifest.short_name).not.toMatch(prohibitedForm);
  });

  it("the package name does not start with 'pi' — the app URL rule mirrors it", () => {
    // "Your app's URL/domain must not start with 'pi'". The package name seeds
    // the default deployment subdomain, so it is the first place this leaks.
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { name: string };
    expect(pkg.name.toLowerCase().startsWith("pi")).toBe(false);
  });

  it("no trace of the old non-compliant name survives anywhere", () => {
    for (const file of [
      "package.json",
      "public/manifest.webmanifest",
      "src/app/layout.tsx",
      "SUBMISSION.md",
      "README.md",
    ]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/PiPulse/i);
    }
  });
});

describe("no external redirects out of the Pi ecosystem", () => {
  it("the only outbound host in the UI is the Pi SDK itself", () => {
    // Ecosystem rule: apps should not redirect users to external websites.
    // sdk.minepi.com is the official SDK and is required, not a redirect.
    const files = [
      "src/components/DisclaimerFooter.tsx",
      "src/components/SignalsDisabledNotice.tsx",
      "src/app/page.tsx",
      "src/app/learn/page.tsx",
    ];
    for (const f of files) {
      const hosts = [...readFileSync(f, "utf8").matchAll(/https?:\/\/([^\s"'`)]+)/g)].map(
        (m) => m[1] ?? ""
      );
      const external = hosts.filter((h) => !h.startsWith("sdk.minepi.com"));
      expect(external).toEqual([]);
    }
  });
});
