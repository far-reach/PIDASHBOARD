import { afterEach, describe, expect, it, vi } from "vitest";
import { isCronRequest } from "@/lib/cron-auth";
import { createDb } from "@/lib/db";
import { GET as validationKeyGet } from "@/app/validation-key.txt/route";
import type { NextRequest } from "next/server";

const req = (authorization: string | null): NextRequest =>
  ({ headers: { get: (k: string) => (k.toLowerCase() === "authorization" ? authorization : null) } }) as NextRequest;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Pi domain-validation endpoint", () => {
  it("serves the configured key as plain text", async () => {
    vi.stubEnv("PI_VALIDATION_KEY", "abc123validationkey");
    const res = validationKeyGet();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect((await res.text()).trim()).toBe("abc123validationkey");
  });

  it("serves the key BYTE-EXACT — no trailing newline for a strict verifier", async () => {
    vi.stubEnv("PI_VALIDATION_KEY", "  abc123validationkey\n");
    const res = validationKeyGet();
    // Not .trim()ed on the way out: the portal may compare the raw body.
    expect(await res.text()).toBe("abc123validationkey");
  });

  it("404s with an actionable message when unset, rather than serving an empty file", async () => {
    vi.stubEnv("PI_VALIDATION_KEY", "");
    const res = validationKeyGet();
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("PI_VALIDATION_KEY");
  });
});

describe("cron endpoint auth fails closed", () => {
  it("rejects a missing or malformed header", () => {
    vi.stubEnv("ADMIN_API_KEY", "test-key-1234567890abcdef");
    expect(isCronRequest(req(null))).toBe(false);
    expect(isCronRequest(req("test-key-1234567890abcdef"))).toBe(false); // no Bearer prefix
  });

  it("rejects a wrong token", () => {
    vi.stubEnv("ADMIN_API_KEY", "test-key-1234567890abcdef");
    expect(isCronRequest(req("Bearer wrongwrongwrongwrongwrong"))).toBe(false);
  });

  it("accepts CRON_SECRET and the operator key", () => {
    vi.stubEnv("CRON_SECRET", "cron-secret-1234567890abcdef");
    vi.stubEnv("ADMIN_API_KEY", "test-key-1234567890abcdef");
    expect(isCronRequest(req("Bearer cron-secret-1234567890abcdef"))).toBe(true);
    expect(isCronRequest(req("Bearer test-key-1234567890abcdef"))).toBe(true);
  });

  it("authorizes NOTHING when no secret is configured", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("ADMIN_API_KEY", "");
    expect(isCronRequest(req("Bearer anything-at-all-here"))).toBe(false);
  });

  it("rejects placeholder and too-short secrets", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("ADMIN_API_KEY", "change-me-dev-only");
    expect(isCronRequest(req("Bearer change-me-dev-only"))).toBe(false);
  });
});

describe("production database guard", () => {
  it("refuses to start on the embedded database in production without DATABASE_URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("ALLOW_EMBEDDED_DB_IN_PRODUCTION", "");
    await expect(createDb()).rejects.toThrow(/DATABASE_URL is not set/);
  });

  it("allows the explicit self-hosted opt-out", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("ALLOW_EMBEDDED_DB_IN_PRODUCTION", "1");
    const db = await createDb({ memory: true });
    expect(db.kind).toBe("pglite");
    await db.close();
  });
});
