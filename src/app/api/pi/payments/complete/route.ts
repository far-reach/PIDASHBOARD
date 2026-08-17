import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser, getSubscription } from "@/lib/auth";
import { completePayment, PiPlatformError } from "@/lib/pi/server";
import { activateSubscription, recordPayment } from "@/lib/users";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { maxTipPi, minTipPi, proPricePi, tipsEnabled } from "@/lib/env";
import { classifyPayment } from "@/lib/pi/products";
import { reportError } from "@/lib/observability";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  paymentId: z.string().min(1).max(200),
  txid: z.string().min(1).max(200),
});

/**
 * POST /api/pi/payments/complete { paymentId, txid }
 *
 * Completion leg. Three independent checks must pass before any entitlement:
 *   1. the Pi platform confirms the transaction (never the client; a hacked
 *      SDK can claim anything; the official docs are explicit about this)
 *   2. the payment belongs to the session user
 *   3. the amount covers the advertised price
 * Activation is additionally idempotent per payment id, so replaying the same
 * completed payment cannot stack extra subscription days.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`pay:${clientKey(req)}`, { capacity: 10, refillPerSec: 0.2 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }
  const user = getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "sign in with Pi first" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "paymentId and txid required" }, { status: 422 });
  }

  try {
    const payment = await completePayment(parsed.data.paymentId, parsed.data.txid);

    if (payment.user_uid !== user.uid) {
      await recordPayment(payment, "failed", parsed.data.txid);
      return NextResponse.json({ error: "payment belongs to a different user" }, { status: 403 });
    }

    const verified = payment.status.developer_completed || payment.status.transaction_verified;
    if (!verified) {
      await recordPayment(payment, "failed", parsed.data.txid);
      return NextResponse.json({ error: "Pi platform did not verify the transaction" }, { status: 402 });
    }

    const verdict = classifyPayment(payment.metadata, payment.amount, {
      proPrice: proPricePi(),
      minTip: minTipPi(),
      maxTip: maxTipPi(),
      tipsEnabled: tipsEnabled(),
    });
    if (!verdict.ok) {
      await recordPayment(payment, "failed", parsed.data.txid);
      return NextResponse.json({ error: verdict.error }, { status: verdict.status });
    }

    await recordPayment(payment, "completed", parsed.data.txid, verdict.kind);

    // A tip is thanks, not a purchase: it is banked and acknowledged, and it
    // deliberately does not touch entitlements.
    if (verdict.kind === "tip") {
      return NextResponse.json({ ok: true, kind: "tip", amount: verdict.amount });
    }

    const { expiresAt, alreadyCredited } = await activateSubscription(user.uid, payment.identifier);
    const subscription = await getSubscription(user.uid);
    return NextResponse.json({ ok: true, kind: "pro", subscription, expiresAt, alreadyCredited });
  } catch (err) {
    if (err instanceof PiPlatformError && err.status === 501) {
      return NextResponse.json({ error: "payments are not configured on this deployment" }, { status: 501 });
    }
    reportError("pi payment completion failed", err, { paymentId: parsed.data.paymentId });
    return NextResponse.json({ error: "payment completion failed" }, { status: 502 });
  }
}
