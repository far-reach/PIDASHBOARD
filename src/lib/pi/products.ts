/**
 * What a Pi payment is *for*, and whether it is acceptable.
 *
 * Two products exist:
 *   - `pipulse-pro-30d` — the 30-day Pro subscription (a fixed price; buying it
 *     grants an entitlement).
 *   - `pipulse-tip`     — a voluntary tip to the developer. Any amount inside
 *     the configured bounds is accepted and it grants **nothing**. That is the
 *     point: a tip must never be a cheaper back door into Pro.
 *
 * The classification is driven by the metadata on the payment as returned by
 * the Pi platform (`getPayment` / `completePayment`), never by anything the
 * client sends alongside its request — the client controls only the payment it
 * asks Pi to create, and Pi is then the source of truth for what that payment
 * says. An unrecognised product is rejected rather than defaulted, so a future
 * product cannot silently inherit another one's rules.
 */

export const PRODUCT_PRO = "pipulse-pro-30d";
export const PRODUCT_TIP = "pipulse-tip";

export type PaymentKind = "pro" | "tip";

export interface PaymentLimits {
  proPrice: number;
  minTip: number;
  maxTip: number;
  tipsEnabled: boolean;
}

export type Classification =
  | { ok: true; kind: PaymentKind; amount: number }
  | { ok: false; status: 402 | 403 | 422; error: string };

/** Float representation slack only — never a discount. */
const EPS = 1e-9;

/**
 * The product a payment names, for labelling purposes only — no amount or
 * eligibility check. Reconciliation of an already-stuck payment uses this so
 * the ledger records what the payment actually was; anything that grants
 * something must use `classifyPayment` instead.
 */
export function productKind(metadata: Record<string, unknown> | null | undefined): PaymentKind {
  return metadata?.product === PRODUCT_TIP ? "tip" : "pro";
}

export function classifyPayment(
  metadata: Record<string, unknown> | null | undefined,
  rawAmount: unknown,
  limits: PaymentLimits
): Classification {
  const product = typeof metadata?.product === "string" ? metadata.product : null;
  const amount = Number(rawAmount);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, status: 402, error: "payment amount is not a positive number" };
  }

  if (product === PRODUCT_PRO) {
    if (amount + EPS < limits.proPrice) {
      return {
        ok: false,
        status: 402,
        error: `payment amount ${amount} π is below the required ${limits.proPrice} π`,
      };
    }
    return { ok: true, kind: "pro", amount };
  }

  if (product === PRODUCT_TIP) {
    if (!limits.tipsEnabled) {
      return { ok: false, status: 403, error: "tips are not enabled on this deployment" };
    }
    if (amount + EPS < limits.minTip) {
      return {
        ok: false,
        status: 402,
        error: `tip of ${amount} π is below the ${limits.minTip} π minimum`,
      };
    }
    if (amount - EPS > limits.maxTip) {
      return {
        ok: false,
        status: 402,
        error: `tip of ${amount} π is above the ${limits.maxTip} π maximum`,
      };
    }
    return { ok: true, kind: "tip", amount };
  }

  return {
    ok: false,
    status: 422,
    error: "payment metadata does not name a product this app sells",
  };
}
