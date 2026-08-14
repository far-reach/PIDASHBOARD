import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { completePayment, getPayment, PiPlatformError } from "@/lib/pi/server";
import { recordPayment } from "@/lib/users";
import { clientKey, rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  paymentId: z.string().min(1).max(200),
  txid: z.string().min(1).max(200).optional(),
});

/**
 * POST /api/pi/payments/incomplete { paymentId, txid? }
 * Called from the SDK's onIncompletePaymentFound callback: a previous
 * payment got stuck between the blockchain transaction and completion.
 * The server re-checks the payment with the Pi platform and completes it if
 * (and only if) the platform reports a verified transaction. No entitlement
 * is granted here — the user re-triggers /complete via the normal flow once
 * signed in, and payment state is reconciled from the platform's record.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`pay:${clientKey(req)}`, { capacity: 10, refillPerSec: 0.2 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
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
    const txid = parsed.data.txid ?? current.transaction?.txid;
    if (!txid || !current.transaction?.verified) {
      await recordPayment(current, "cancelled", txid ?? null);
      return NextResponse.json({ ok: true, resolution: "no verified transaction; left cancelled" });
    }
    const completed = await completePayment(current.identifier, txid);
    await recordPayment(completed, "completed", txid);
    return NextResponse.json({ ok: true, resolution: "completed" });
  } catch (err) {
    const status = err instanceof PiPlatformError ? (err.status === 501 ? 501 : 502) : 502;
    return NextResponse.json(
      { error: "could not reconcile payment", detail: err instanceof Error ? err.message : "unknown" },
      { status }
    );
  }
}
