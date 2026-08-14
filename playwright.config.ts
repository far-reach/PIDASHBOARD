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
    url: "http://127.0.0.1:3100/api/health",
    timeout: 180_000,
    reuseExistingServer: true,
  },
});
