import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { approvePayment, getPaymentSoonAfterCreation, PiPlatformError } from "@/lib/pi/server";
import { recordPayment } from "@/lib/users";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { maxTipPi, minTipPi, proPricePi, tipsEnabled } from "@/lib/env";
import { classifyPayment } from "@/lib/pi/products";
import { reportError } from "@/lib/observability";
import { recordTrail } from "@/lib/pi/diagnostics";

export const dynamic = "force-dynamic";
// The wallet allows 45s; a cold start plus the platform round trips must fit
// inside the function budget, which defaults lower than that.
export const maxDuration = 30;

const bodySchema = z.object({ paymentId: z.string().min(1).max(200) });

/**
 * POST /api/pi/payments/approve { paymentId }
 * Server-side approval leg of the Pi payment flow.
 *
 * The payment is READ FROM THE PI PLATFORM FIRST and its owner, product and
 * amount are checked BEFORE approving. Approving without checking the amount
 * would let a user create a payment of any trivial amount and receive a full
 * subscription; a tip is bounded instead of priced, and grants nothing.
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
    return NextResponse.json({ error: "paymentId required" }, { status: 422 });
  }

  const paymentId = parsed.data.paymentId;
  try {
    /*
     * Read the payment first so ownership, product and amount can be checked.
     * If it is not readable yet even after retries, approve anyway rather
     * than stranding the payment: approval moves no funds and grants nothing,
     * and the completion leg independently re-checks ownership, platform
     * verification, product and amount before anything is credited. Refusing
     * here would turn a transient read into a dead payment.
     */
    let pending = null;
    try {
      pending = await getPaymentSoonAfterCreation(paymentId);
    } catch (readErr) {
      reportError("could not read the payment before approving", readErr, { paymentId });
      await recordTrail({
        step: "approve",
        outcome: "failed",
        paymentId,
        detail: `pre-check read failed, approving on the completion leg's checks: ${
          readErr instanceof Error ? readErr.message : "unknown"
        }`,
      });
    }

    if (pending && pending.user_uid !== user.uid) {
      await recordTrail({
        step: "approve",
        outcome: "failed",
        paymentId,
        detail: "payment belongs to a different user",
      });
      return NextResponse.json({ error: "payment belongs to a different user" }, { status: 403 });
    }

    let kind = undefined;
    if (pending) {
      const verdict = classifyPayment(pending.metadata, pending.amount, {
        proPrice: proPricePi(),
        minTip: minTipPi(),
        maxTip: maxTipPi(),
        tipsEnabled: tipsEnabled(),
      });
      if (!verdict.ok) {
        await recordPayment(pending, "failed", null);
        await recordTrail({ step: "approve", outcome: "failed", paymentId, detail: verdict.error });
        return NextResponse.json({ error: verdict.error }, { status: verdict.status });
      }
      kind = verdict.kind;
    }

    const payment = await approvePayment(paymentId);
    // The ledger write must never undo an approval the platform has already
    // accepted, so a database failure here is logged, not propagated.
    try {
      await recordPayment(payment, "approved", null, kind);
    } catch (dbErr) {
      reportError("approved but could not write the payment row", dbErr, { paymentId });
    }
    await recordTrail({ step: "approve", outcome: "ok", paymentId, detail: kind ?? "approved" });
    return NextResponse.json({ ok: true, paymentId: payment.identifier, kind });
  } catch (err) {
    if (err instanceof PiPlatformError && err.status === 501) {
      return NextResponse.json({ error: "payments are not configured on this deployment" }, { status: 501 });
    }
    if (err instanceof PiPlatformError && err.status === 401) {
      // The PLATFORM rejected our key, not the user's session: the classic
      // cause is a Testnet API key on a Mainnet app (or vice versa).
      return NextResponse.json(
        { error: "the Pi platform rejected this app's API key; PI_API_KEY likely belongs to the wrong network" },
        { status: 502 }
      );
    }
    reportError("pi payment approval failed", err, { paymentId });
    await recordTrail({
      step: "approve",
      outcome: "failed",
      paymentId,
      detail: err instanceof PiPlatformError ? `platform HTTP ${err.status}: ${err.message}` : String(err),
    });
    return NextResponse.json({ error: "payment approval failed" }, { status: 502 });
  }
}
