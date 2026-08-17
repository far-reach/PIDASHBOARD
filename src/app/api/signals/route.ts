import { NextResponse, type NextRequest } from "next/server";
import { canSeeOpenSignals, isAdminRequest } from "@/lib/auth";
import { monetizationMode, SYMBOL } from "@/lib/env";
import { getLatestPrice } from "@/lib/feed";
import { clientKey, rateLimit } from "@/lib/ratelimit";
import { createSignal, listSignalsWithOutcomes } from "@/lib/signals/repo";
import { newSignalSchema } from "@/lib/signals/schema";
import { signalsReadDisabled, signalsWriteBlocked } from "@/lib/signals/gate";
import { unrealizedR } from "@/lib/signals/outcome";
import type { SignalWithOutcome } from "@/lib/signals/types";

export const dynamic = "force-dynamic";

function presentSignal(s: SignalWithOutcome, currentPrice: number | null) {
  return {
    id: s.id,
    symbol: s.symbol,
    direction: s.direction,
    entry: s.entry,
    stop: s.stop,
    target: s.target,
    rationale: s.rationale,
    issued_at: s.issuedAt,
    expires_at: s.expiresAt,
    visible_from: s.visibleFrom,
    source: s.source,
    is_test: s.isTest,
    status: s.status,
    r: s.r,
    exit_price: s.exitPrice,
    closed_at: s.closedAt,
    filled: s.filled,
    filled_at: s.filledAt,
    // The row's true insertion time, alongside the operator-declared issue
    // time: publishing this makes any gap between the two visible.
    created_at: s.createdAt,
    unrealized_r:
      s.status === "open" && currentPrice !== null
        ? Math.round(unrealizedR(s, currentPrice) * 10000) / 10000
        : null,
    events: s.events.map((e) => ({
      type: e.type,
      price: e.price,
      price_source: e.priceSource,
      note: e.note,
      occurred_at: e.occurredAt,
    })),
  };
}

/**
 * GET /api/signals; the feed.
 * Closed signals + full history: always public (brief §3.8; honesty is never
 * gated). Open signals: gated only in freemium mode. Delayed-publish signals
 * (visible_from in the future) are hidden from non-admins while open.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const rl = rateLimit(`signals:${clientKey(req)}`, { capacity: 60, refillPerSec: 1 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  if (signalsReadDisabled()) {
    return NextResponse.json({
      signals: [],
      meta: {
        symbol: SYMBOL,
        monetization: monetizationMode(),
        signals_enabled: false,
        open_signals_visible: true,
        hidden_open_count: 0,
        current_price: null,
        price_as_of: null,
        as_of: new Date().toISOString(),
      },
    });
  }

  const admin = isAdminRequest(req);
  const includeTest = admin && req.nextUrl.searchParams.get("include_test") === "1";
  const all = await listSignalsWithOutcomes({ symbol: SYMBOL, includeTest, limit: 200 });

  const now = Date.now();
  const visible = admin
    ? all
    : all.filter(
        (s) =>
          s.status !== "open" ||
          s.visibleFrom === null ||
          new Date(s.visibleFrom).getTime() <= now
      );

  const openVisible = admin || (await canSeeOpenSignals(req));
  const open = visible.filter((s) => s.status === "open");
  const served = openVisible ? visible : visible.filter((s) => s.status !== "open");

  let currentPrice: number | null = null;
  let priceAsOf: string | null = null;
  try {
    const latest = await getLatestPrice(SYMBOL);
    currentPrice = latest.price;
    priceAsOf = latest.ts;
  } catch {
    // Feed down: serve the log without unrealized PnL rather than failing.
  }

  return NextResponse.json({
    signals: served.map((s) => presentSignal(s, currentPrice)),
    meta: {
      symbol: SYMBOL,
      monetization: monetizationMode(),
      open_signals_visible: openVisible,
      // Never hide THAT open signals exist; only their contents are gated.
      hidden_open_count: openVisible ? 0 : open.length,
      current_price: currentPrice,
      price_as_of: priceAsOf,
      as_of: new Date().toISOString(),
    },
  });
}

/**
 * POST /api/signals; operator-only publication (brief §Phase 3.1).
 * Writes an immutable signal + its `published` event. There is deliberately
 * no PATCH/PUT/DELETE anywhere under /api/signals.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const blocked = signalsWriteBlocked();
  if (blocked) return blocked;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = newSignalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }
  const input = parsed.data;
  const signal = await createSignal({
    symbol: input.symbol,
    direction: input.direction,
    entry: input.entry,
    stop: input.stop,
    target: input.target,
    rationale: input.rationale,
    issuedAt: input.issued_at,
    expiresAt: input.expires_at ?? null,
    visibleFrom: input.visible_from ?? null,
    source: input.source,
    isTest: input.is_test,
  });
  return NextResponse.json(
    {
      signal: presentSignal(
        {
          ...signal,
          events: [],
          status: "open",
          r: null,
          exitPrice: null,
          closedAt: null,
          filled: false,
          filledAt: null,
        },
        null
      ),
    },
    { status: 201 }
  );
}

const immutable = () =>
  NextResponse.json(
    {
      error: "signals are immutable",
      detail:
        "Published signals cannot be edited or deleted (append-only event log). To close one early, POST a manual_close event to /api/signals/{id}/events with a reason.",
    },
    { status: 405, headers: { Allow: "GET, POST" } }
  );

export const PATCH = immutable;
export const PUT = immutable;
export const DELETE = immutable;
