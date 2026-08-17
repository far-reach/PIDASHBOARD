import { NextResponse, type NextRequest } from "next/server";
import { canSeeOpenSignals, isAdminRequest } from "@/lib/auth";
import { getSignalWithOutcome } from "@/lib/signals/repo";
import { signalsReadDisabled } from "@/lib/signals/gate";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (signalsReadDisabled()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { id } = await ctx.params;
  const signal = await getSignalWithOutcome(id);
  if (!signal || (signal.isTest && !isAdminRequest(req))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const admin = isAdminRequest(req);
  if (!admin && signal.status === "open") {
    const now = Date.now();
    if (signal.visibleFrom !== null && new Date(signal.visibleFrom).getTime() > now) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (!(await canSeeOpenSignals(req))) {
      return NextResponse.json({ error: "open signals require a subscription" }, { status: 403 });
    }
  }
  return NextResponse.json({
    signal: {
      id: signal.id,
      symbol: signal.symbol,
      direction: signal.direction,
      entry: signal.entry,
      stop: signal.stop,
      target: signal.target,
      rationale: signal.rationale,
      issued_at: signal.issuedAt,
      expires_at: signal.expiresAt,
      status: signal.status,
      r: signal.r,
      exit_price: signal.exitPrice,
      closed_at: signal.closedAt,
      events: signal.events.map((e) => ({
        type: e.type,
        price: e.price,
        price_source: e.priceSource,
        note: e.note,
        occurred_at: e.occurredAt,
      })),
    },
  });
}

const immutable = () =>
  NextResponse.json(
    {
      error: "signals are immutable",
      detail:
        "Published signals cannot be edited or deleted. To close one early, POST a manual_close event to /api/signals/{id}/events with a reason.",
    },
    { status: 405, headers: { Allow: "GET" } }
  );

export const PATCH = immutable;
export const PUT = immutable;
export const DELETE = immutable;
