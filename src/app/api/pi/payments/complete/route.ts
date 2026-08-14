import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser, getSubscription } from "@/lib/auth";
import { completePayment, PiPlatformError } from "@/lib/pi/server";
import { activateSubscription, recordPayment } from "@/lib/users";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  paymentId: z.string().min(1).max(200),
  txid: z.string().min(1).max(200),
});

/**
 * POST /api/pi/payments/complete { paymentId, txid }
 * Completion leg: the server confirms with the Pi platform that the
 * blockchain transaction is verified BEFORE any entitlement is granted
 * (brief §Phase 4.5 — never trust client-side "paid" claims).
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
    if (!payment.status.developer_completed && !payment.status.transaction_verified) {
      await recordPayment(payment, "failed", parsed.data.txid);
      return NextResponse.json({ error: "Pi platform did not verify the transaction" }, { status: 402 });
    }
    await recordPayment(payment, "completed", parsed.data.txid);
    await activateSubscription(user.uid, payment.identifier);
    const subscription = await getSubscription(user.uid);
    return NextResponse.json({ ok: true, subscription });
  } catch (err) {
    const status = err instanceof PiPlatformError ? (err.status === 501 ? 501 : 502) : 502;
    return NextResponse.json(
      { error: "payment completion failed", detail: err instanceof Error ? err.message : "unknown" },
      { status }
    );
  }
}
