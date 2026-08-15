import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { getLatestPrice } from "@/lib/feed";
import { getSignalWithOutcome, insertEvent } from "@/lib/signals/repo";
import { manualCloseSchema, MANUAL_CLOSE_TOLERANCE_PCT } from "@/lib/signals/schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/signals/{id}/events — the ONLY write available on a published
 * signal, and it only appends: an operator manual_close with a mandatory
 * reason (brief §8: a bad signal is never deleted; it is closed with the
 * loss booked). The DB's unique terminal index rejects a second close.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const signal = await getSignalWithOutcome(id);
  if (!signal) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (signal.status !== "open") {
    return NextResponse.json(
      { error: `signal already closed (${signal.status})` },
      { status: 409 }
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = manualCloseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  // The close price is taken from the live market. An operator-supplied price
  // is accepted only as a tie-break within a tight band of it — otherwise
  // "close early at a price of my choosing" would be a direct dial on the
  // published win rate, which is exactly what the immutable log exists to
  // prevent.
  let price: number;
  let priceSource: string;
  try {
    const latest = await getLatestPrice(signal.symbol);
    const supplied = parsed.data.price;
    if (supplied !== undefined) {
      const deviationPct = Math.abs(supplied - latest.price) / latest.price * 100;
      if (deviationPct > MANUAL_CLOSE_TOLERANCE_PCT) {
        return NextResponse.json(
          {
            error: `supplied price ${supplied} deviates ${deviationPct.toFixed(2)}% from the live market (${latest.price}); max ${MANUAL_CLOSE_TOLERANCE_PCT}%`,
          },
          { status: 422 }
        );
      }
      price = supplied;
      priceSource = `manual (within ${MANUAL_CLOSE_TOLERANCE_PCT}% of ${latest.source})`;
    } else {
      price = latest.price;
      priceSource = latest.source;
    }
  } catch {
    // The feed is down. Refusing outright would leave the operator unable to
    // close a position during exactly the conditions where closing matters
    // most. Instead the close is allowed with an explicit price, and the
    // record permanently states that this exit was never market-verified —
    // the immutable log is what makes that disclosure trustworthy.
    const supplied = parsed.data.price;
    if (supplied === undefined) {
      return NextResponse.json(
        {
          error:
            "no live price available — supply an explicit close price; it will be recorded as operator-supplied and unverified",
        },
        { status: 503 }
      );
    }
    price = supplied;
    priceSource = "operator-supplied (UNVERIFIED — no market feed at close time)";
  }

  try {
    const event = await insertEvent({
      signalId: id,
      type: "manual_close",
      price,
      priceSource,
      note: parsed.data.note,
    });
    return NextResponse.json(
      {
        event: {
          type: event.type,
          price: event.price,
          price_source: event.priceSource,
          note: event.note,
          occurred_at: event.occurredAt,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "signal already closed" }, { status: 409 });
  }
}

const immutable = () =>
  NextResponse.json(
    { error: "events are append-only" },
    { status: 405, headers: { Allow: "POST" } }
  );

export const PATCH = immutable;
export const PUT = immutable;
export const DELETE = immutable;
