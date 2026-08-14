import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { createSignal, insertEvent } from "@/lib/signals/repo";
import { createTestDb } from "./helpers";

/**
 * Non-negotiable §3.1: signal history is immutable, enforced AT THE DATABASE.
 * These tests run real UPDATE/DELETE statements against the real schema
 * (PGlite = actual Postgres) and expect the triggers to reject them.
 */
describe("database-level immutability", () => {
  let db: Db;
  let signalId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const signal = await createSignal(
      {
        symbol: "PIUSDT",
        direction: "long",
        entry: 0.5,
        stop: 0.45,
        target: 0.6,
        rationale: "immutability test",
        isTest: true,
      },
      db
    );
    signalId = signal.id;
  });

  afterAll(async () => {
    await db.close();
  });

  it("UPDATE on signals is rejected by trigger", async () => {
    await expect(
      db.query(`UPDATE signals SET entry = 0.99 WHERE id = $1`, [signalId])
    ).rejects.toThrow(/append-only/i);
  });

  it("DELETE on signals is rejected by trigger", async () => {
    await expect(db.query(`DELETE FROM signals WHERE id = $1`, [signalId])).rejects.toThrow(
      /append-only/i
    );
  });

  it("UPDATE and DELETE on signal_events are rejected by trigger", async () => {
    await expect(db.query(`UPDATE signal_events SET price = 1 WHERE signal_id = $1`, [signalId]))
      .rejects.toThrow(/append-only/i);
    await expect(db.query(`DELETE FROM signal_events WHERE signal_id = $1`, [signalId]))
      .rejects.toThrow(/append-only/i);
  });

  it("only ONE terminal event can ever exist per signal (unique partial index)", async () => {
    await insertEvent(
      { signalId, type: "hit_tp", price: 0.6, priceSource: "test", note: "" },
      db
    );
    await expect(
      insertEvent({ signalId, type: "hit_sl", price: 0.45, priceSource: "test", note: "" }, db)
    ).rejects.toThrow();
  });

  it("the signals check constraint rejects inverted long levels", async () => {
    await expect(
      createSignal(
        {
          symbol: "PIUSDT",
          direction: "long",
          entry: 0.5,
          stop: 0.55, // stop above entry on a long — invalid
          target: 0.6,
          rationale: "bad",
          isTest: true,
        },
        db
      )
    ).rejects.toThrow();
  });
});

describe("API surface has no mutation verbs", () => {
  it("signals routes export PATCH/PUT/DELETE handlers that answer 405", async () => {
    const route = await import("@/app/api/signals/route");
    for (const handler of [route.PATCH, route.PUT, route.DELETE]) {
      const res = handler();
      expect(res.status).toBe(405);
      const body = (await res.json()) as { error: string };
      expect(body.error).toMatch(/immutable/i);
    }
  });

  it("signal detail route also answers 405 for mutations", async () => {
    const route = await import("@/app/api/signals/[id]/route");
    for (const handler of [route.PATCH, route.PUT, route.DELETE]) {
      expect(handler().status).toBe(405);
    }
  });

  it("events route rejects mutation verbs too", async () => {
    const route = await import("@/app/api/signals/[id]/events/route");
    for (const handler of [route.PATCH, route.PUT, route.DELETE]) {
      expect(handler().status).toBe(405);
    }
  });

  it("repo module contains no UPDATE or DELETE on the immutable tables", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("src/lib/signals/repo.ts", "utf8");
    expect(src).not.toMatch(/UPDATE\s+signals/i);
    expect(src).not.toMatch(/DELETE\s+FROM\s+signals/i);
    expect(src).not.toMatch(/UPDATE\s+signal_events/i);
    expect(src).not.toMatch(/DELETE\s+FROM\s+signal_events/i);
  });
});
