import { describe, expect, it, vi, afterEach } from "vitest";
import { piApiBase, piApiKey } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());

/**
 * Both of these presented identically on a real phone: the Pi wallet
 * counting down and then reporting "the developer has failed to approve
 * this payment", with nothing on screen naming the cause.
 */
describe("Pi platform credentials survive being pasted into a hosting dashboard", () => {
  it("trims whitespace around the API key", () => {
    // A key copied on a phone arrives with a trailing newline more often
    // than not, and an Authorization header carrying one is rejected.
    vi.stubEnv("PI_API_KEY", "  abcdef1234567890\n");
    expect(piApiKey()).toBe("abcdef1234567890");
  });

  it("reports an all-whitespace key as absent rather than configured", () => {
    vi.stubEnv("PI_API_KEY", "   ");
    expect(piApiKey()).toBe("");
  });

  it("strips trailing slashes from the API base so paths cannot double up", () => {
    vi.stubEnv("PI_API_BASE", "https://api.minepi.com/v2/");
    expect(piApiBase()).toBe("https://api.minepi.com/v2");
  });

  it("treats a BLANK base variable as unset, not as an empty base URL", () => {
    // A variable created and later cleared in a hosting dashboard arrives as
    // "", which `??` keeps: every platform call then went to a relative URL.
    vi.stubEnv("PI_API_BASE", "");
    expect(piApiBase()).toBe("https://api.minepi.com/v2");
    vi.stubEnv("PI_API_BASE", "   ");
    expect(piApiBase()).toBe("https://api.minepi.com/v2");
  });
});
