import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/auth";
import { getLatestPrice } from "@/lib/feed";
import { getSignalWithOutcome, insertEvent } from "@/lib/signals/repo";
import { manualCloseSchema } from "@/lib/signals/schema";

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

  let price = parsed.data.price ?? null;
  let priceSource: string | null = "manual";
  if (price === null) {
    try {
      const latest = await getLatestPrice(signal.symbol);
      price = latest.price;
      priceSource = latest.source;
    } catch {
      return NextResponse.json(
        { error: "no live price available — supply an explicit close price" },
        { status: 503 }
      );
    }
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
