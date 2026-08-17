import fs from "node:fs";
import { defineConfig } from "@playwright/test";

// In the dev sandbox a pre-provisioned Chromium lives here; elsewhere
// Playwright resolves its own managed browser.
const SANDBOX_CHROMIUM = "/opt/pw-browsers/chromium";
const executablePath = fs.existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false, // specs share one seeded database
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    // Pi Browser is a mobile webview — mobile-first testing (brief §Phase 2.6).
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: "npm run e2e:server",
    // NOT /api/health: it honestly reports 503 while the exchange feed is
    // unreachable (as in sandboxed CI), and this probe requires a 2xx, so the
    // suite would never start. Readiness here means "the server answers",
    // which a static file asserts without an opinion on upstream feeds.
    url: "http://127.0.0.1:3100/robots.txt",
    timeout: 180_000,
    reuseExistingServer: true,
  },
});
