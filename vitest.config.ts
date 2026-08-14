import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000, // PGlite cold-start in CI can take a few seconds
    pool: "forks", // isolate PGlite WASM instances between test files
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
