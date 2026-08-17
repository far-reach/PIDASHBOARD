import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { classifyPayment, productKind, PRODUCT_PRO, PRODUCT_TIP } from "@/lib/pi/products";
import { recordPayment } from "@/lib/users";
import { createTestDb } from "./helpers";
import type { Db } from "@/lib/db";
import type { PiPaymentDTO } from "@/lib/pi/server";

const LIMITS = { proPrice: 1, minTip: 0.1, maxTip: 1000, tipsEnabled: true };

describe("payment classification", () => {
  it("accepts a subscription payment at or above the price", () => {
    expect(classifyPayment({ product: PRODUCT_PRO }, 1, LIMITS)).toEqual({
      ok: true,
      kind: "pro",
      amount: 1,
    });
    expect(classifyPayment({ product: PRODUCT_PRO }, 5, LIMITS)).toMatchObject({ kind: "pro" });
  });

  it("rejects a subscription payment below the price", () => {
    const v = classifyPayment({ product: PRODUCT_PRO }, 0.5, LIMITS);
    expect(v).toMatchObject({ ok: false, status: 402 });
  });

  it("accepts a tip of any amount inside the bounds", () => {
    for (const amount of [0.1, 1, 2.5, 1000]) {
      expect(classifyPayment({ product: PRODUCT_TIP }, amount, LIMITS)).toMatchObject({
        ok: true,
        kind: "tip",
        amount,
      });
    }
  });

  it("accepts a tip BELOW the subscription price — a tip is not priced", () => {
    // The regression this guards: the amount check used to be global, so any
    // payment under PRO_PRICE_PI was refused. A 0.5 π tip must go through.
    expect(classifyPayment({ product: PRODUCT_TIP }, 0.5, LIMITS)).toMatchObject({
      ok: true,
      kind: "tip",
    });
  });

  it("rejects dust below the minimum and a fat-fingered amount above the maximum", () => {
    expect(classifyPayment({ product: PRODUCT_TIP }, 0.01, LIMITS)).toMatchObject({
      ok: false,
      status: 402,
    });
    expect(classifyPayment({ product: PRODUCT_TIP }, 100_000, LIMITS)).toMatchObject({
      ok: false,
      status: 402,
    });
  });

  it("rejects tips when the deployment has them switched off", () => {
    expect(
      classifyPayment({ product: PRODUCT_TIP }, 1, { ...LIMITS, tipsEnabled: false })
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects zero, negative and non-numeric amounts", () => {
    for (const bad of [0, -5, "", "abc", null, undefined, NaN]) {
      expect(classifyPayment({ product: PRODUCT_TIP }, bad, LIMITS)).toMatchObject({ ok: false });
      expect(classifyPayment({ product: PRODUCT_PRO }, bad, LIMITS)).toMatchObject({ ok: false });
    }
  });

  it("rejects an unrecognised or missing product instead of defaulting", () => {
    // A payment that names no product must not inherit either rule set.
    for (const meta of [{}, null, undefined, { product: "something-else" }, { product: 42 }]) {
      expect(classifyPayment(meta as Record<string, unknown>, 1, LIMITS)).toMatchObject({
        ok: false,
        status: 422,
      });
    }
  });

  it("cannot use a tip to obtain Pro cheaply", () => {
    // A cheap payment labelled as a tip classifies as a tip, and the completion
    // route grants entitlements only for kind 'pro'. There is no amount at
    // which a tip becomes a subscription.
    const v = classifyPayment({ product: PRODUCT_TIP }, 0.1, LIMITS);
    expect(v).toMatchObject({ ok: true, kind: "tip" });
    expect(v).not.toMatchObject({ kind: "pro" });
  });
});

describe("productKind labelling", () => {
  it("labels tips, and treats everything else as a subscription payment", () => {
    expect(productKind({ product: PRODUCT_TIP })).toBe("tip");
    expect(productKind({ product: PRODUCT_PRO })).toBe("pro");
    expect(productKind({})).toBe("pro");
    expect(productKind(null)).toBe("pro");
  });
});

describe("tip ledger", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(async () => {
    await db.close();
  });

  function dto(id: string, amount: number, product: string): PiPaymentDTO {
    return {
      identifier: id,
      user_uid: "pi-user-1",
      amount,
      memo: "test",
      metadata: { product },
      status: {
        developer_approved: true,
        transaction_verified: true,
        developer_completed: true,
        cancelled: false,
        user_cancelled: false,
      },
      transaction: { txid: `tx-${id}`, verified: true },
    };
  }

  it("records a tip with kind 'tip' and grants no subscription", async () => {
    await recordPayment(dto("pay-tip-1", 2.5, PRODUCT_TIP), "completed", "tx-1", "tip", db);

    const { rows } = await db.query<{ kind: string; amount: string; status: string }>(
      `SELECT kind, amount, status FROM payments WHERE payment_id = 'pay-tip-1'`
    );
    expect(rows[0]?.kind).toBe("tip");
    expect(rows[0]?.status).toBe("completed");
    expect(Number(rows[0]?.amount)).toBe(2.5);

    const subs = await db.query(`SELECT 1 FROM subscriptions WHERE pi_user_id = 'pi-user-1'`);
    expect(subs.rows).toHaveLength(0);
  });

  it("defaults existing/subscription payments to kind 'pro'", async () => {
    await recordPayment(dto("pay-pro-1", 1, PRODUCT_PRO), "completed", "tx-2", undefined, db);
    const { rows } = await db.query<{ kind: string }>(
      `SELECT kind FROM payments WHERE payment_id = 'pay-pro-1'`
    );
    expect(rows[0]?.kind).toBe("pro");
  });

  it("rejects a kind the schema does not know about", async () => {
    await expect(
      db.query(
        `INSERT INTO payments (payment_id, pi_user_id, amount, kind) VALUES ('x', 'u', 1, 'free-stuff')`
      )
    ).rejects.toThrow();
  });
});
