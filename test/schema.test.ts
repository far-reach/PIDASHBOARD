import { describe, expect, it } from "vitest";
import { manualCloseSchema, newSignalSchema } from "@/lib/signals/schema";

const valid = {
  symbol: "piusdt",
  direction: "long" as const,
  entry: 0.5,
  stop: 0.45,
  target: 0.6,
  rationale: "Our model shows a support retest scenario.",
};

describe("newSignalSchema", () => {
  it("accepts a valid long and uppercases the symbol", () => {
    const parsed = newSignalSchema.parse(valid);
    expect(parsed.symbol).toBe("PIUSDT");
    expect(parsed.source).toBe("manual");
    expect(parsed.is_test).toBe(false);
  });

  it("rejects a long whose stop is above entry", () => {
    const res = newSignalSchema.safeParse({ ...valid, stop: 0.55 });
    expect(res.success).toBe(false);
  });

  it("rejects a short whose target is above entry", () => {
    const res = newSignalSchema.safeParse({
      ...valid,
      direction: "short",
      stop: 0.55,
      target: 0.6,
    });
    expect(res.success).toBe(false);
  });

  it("rejects an empty rationale — users deserve the why", () => {
    const res = newSignalSchema.safeParse({ ...valid, rationale: "  " });
    expect(res.success).toBe(false);
  });

  it("rejects a past expiry", () => {
    const res = newSignalSchema.safeParse({
      ...valid,
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    expect(res.success).toBe(false);
  });

  it("rejects non-positive prices", () => {
    expect(newSignalSchema.safeParse({ ...valid, entry: 0 }).success).toBe(false);
    expect(newSignalSchema.safeParse({ ...valid, entry: -1 }).success).toBe(false);
  });
});

describe("manualCloseSchema", () => {
  it("requires a stated reason", () => {
    expect(manualCloseSchema.safeParse({ note: "" }).success).toBe(false);
    expect(manualCloseSchema.safeParse({ note: "de-risking ahead of listing news" }).success).toBe(
      true
    );
  });
});
