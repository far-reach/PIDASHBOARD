import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { completePayment, getPayment, PiPlatformError } from "@/lib/pi/server";
import { recordPayment } from "@/lib/users";
import { productKind } from "@/lib/pi/products";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { reportError } from "@/lib/observability";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  paymentId: z.string().min(1).max(200),
  txid: z.string().min(1).max(200).optional(),
});

/**
 * POST /api/pi/payments/incomplete { paymentId, txid? }
 *
 * Called from the SDK's onIncompletePaymentFound callback when a previous
 * payment got stuck between the blockchain transaction and completion.
 *
 * Requires a session, and the payment must belong to that user: without the
 * ownership check any caller could push arbitrary payment ids through this
 * endpoint and write rows into the payments ledger. No entitlement is granted
 * here; the user's normal /complete flow does that, with its own amount and
 * ownership checks.
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

  try {
    const current = await getPayment(parsed.data.paymentId);
    if (current.user_uid !== user.uid) {
      return NextResponse.json({ error: "payment belongs to a different user" }, { status: 403 });
    }

    const kind = productKind(current.metadata);
    const txid = parsed.data.txid ?? current.transaction?.txid;
    if (!txid || !current.transaction?.verified) {
      await recordPayment(current, "cancelled", txid ?? null, kind);
      return NextResponse.json({ ok: true, resolution: "no verified transaction; left cancelled" });
    }

    const completed = await completePayment(current.identifier, txid);
    await recordPayment(completed, "completed", txid, productKind(completed.metadata));
    return NextResponse.json({ ok: true, resolution: "completed" });
  } catch (err) {
    if (err instanceof PiPlatformError && err.status === 501) {
      return NextResponse.json({ error: "payments are not configured on this deployment" }, { status: 501 });
    }
    reportError("pi incomplete-payment reconciliation failed", err, {
      paymentId: parsed.data.paymentId,
    });
    return NextResponse.json({ error: "could not reconcile payment" }, { status: 502 });
  }
}
