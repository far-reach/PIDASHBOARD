/**
 * Multi-exchange aggregation with failover (brief §3.6): primary OKX,
 * secondary MEXC. If the primary fails or goes stale the secondary is
 * promoted and the served tick is flagged `isFailover` so the UI can badge
 * it. Bitget is a cross-check only: it contributes a divergence flag, never
 * the served price.
 */
import type {
  Candle,
  ExchangeClient,
  ExchangeId,
  FeedStatus,
  SourceHealth,
  Tick,
  Timeframe,
} from "@/lib/market/types";
import { okx } from "@/lib/market/okx";
import { mexc } from "@/lib/market/mexc";
import { bitget } from "@/lib/market/bitget";

const FRESH_MS = 15_000; // a websocket/pushed tick older than this is not "fresh"
const MAX_DIVERGENCE_WARN = 1.0; // percent

export interface CollectResult {
  tick: Tick;
  isFailover: boolean;
  status: FeedStatus;
}

export class Aggregator {
  private health = new Map<ExchangeId, SourceHealth>();
  private lastTick = new Map<ExchangeId, Tick>();
  /** Ticks pushed from a live stream (worker's OKX websocket). */
  private pushed = new Map<ExchangeId, Tick>();

  constructor(
    private readonly feedSources: ExchangeClient[] = [okx, mexc],
    private readonly crossCheck: ExchangeClient | null = bitget
  ) {
    for (const s of feedSources) this.health.set(s.id, this.emptyHealth(s.id));
    if (crossCheck) this.health.set(crossCheck.id, this.emptyHealth(crossCheck.id));
  }

  private emptyHealth(id: ExchangeId): SourceHealth {
    return { id, ok: false, lastSuccessTs: null, lastError: null, consecutiveFailures: 0 };
  }

  /** Feed a tick from a push stream (websocket). */
  pushTick(tick: Tick): void {
    this.pushed.set(tick.source, tick);
    this.recordSuccess(tick);
  }

  private recordSuccess(tick: Tick): void {
    this.lastTick.set(tick.source, tick);
    const h = this.health.get(tick.source) ?? this.emptyHealth(tick.source);
    this.health.set(tick.source, {
      ...h,
      ok: true,
      lastSuccessTs: Date.now(),
      lastError: null,
      consecutiveFailures: 0,
    });
  }

  private recordFailure(id: ExchangeId, err: unknown): void {
    const h = this.health.get(id) ?? this.emptyHealth(id);
    this.health.set(id, {
      ...h,
      ok: false,
      lastError: err instanceof Error ? err.message : String(err),
      consecutiveFailures: h.consecutiveFailures + 1,
    });
  }

  /**
   * Get the freshest tick from the highest-priority healthy source.
   * Order: pushed (websocket) tick from a source if fresh, else REST fetch,
   * walking the priority list until one answers.
   */
  async collectTick(symbol: string): Promise<CollectResult> {
    let served: Tick | null = null;
    let servedIdx = -1;

    for (let i = 0; i < this.feedSources.length; i++) {
      const client = this.feedSources[i]!;
      const pushed = this.pushed.get(client.id);
      if (pushed && pushed.symbol === symbol && Date.now() - pushed.ts < FRESH_MS) {
        served = pushed;
        servedIdx = i;
        break;
      }
      try {
        served = await client.fetchTicker(symbol);
        this.recordSuccess(served);
        servedIdx = i;
        break;
      } catch (err) {
        this.recordFailure(client.id, err);
      }
    }

    if (!served) {
      throw new Error("all price sources failed");
    }

    // Non-blocking cross-check refresh (divergence honesty flag).
    if (this.crossCheck) {
      void this.crossCheck
        .fetchTicker(symbol)
        .then((t) => this.recordSuccess(t))
        .catch((err) => this.recordFailure(this.crossCheck!.id, err));
    }

    const isFailover = servedIdx > 0;
    return { tick: served, isFailover, status: this.feedStatus(served.source, isFailover) };
  }

  /** Candles with the same priority + failover semantics. */
  async collectCandles(symbol: string, tf: Timeframe, limit: number): Promise<{
    candles: Candle[];
    source: ExchangeId;
    isFailover: boolean;
  }> {
    let lastErr: unknown = new Error("no candle sources");
    for (let i = 0; i < this.feedSources.length; i++) {
      const client = this.feedSources[i]!;
      try {
        const candles = await client.fetchCandles(symbol, tf, limit);
        if (candles.length === 0) throw new Error(`${client.id}: empty candles`);
        return { candles, source: client.id, isFailover: i > 0 };
      } catch (err) {
        lastErr = err;
        this.recordFailure(client.id, err);
      }
    }
    throw lastErr;
  }

  divergencePct(): number | null {
    const ticks = this.feedSources
      .map((s) => this.lastTick.get(s.id))
      .filter((t): t is Tick => !!t && Date.now() - t.ts < 60_000);
    if (ticks.length < 2) return null;
    const [a, b] = [ticks[0]!.price, ticks[1]!.price];
    const mid = (a + b) / 2;
    return mid > 0 ? Math.abs(a - b) / mid * 100 : null;
  }

  feedStatus(activeSource: ExchangeId | null, isFailover: boolean): FeedStatus {
    return {
      activeSource,
      isFailover,
      sources: [...this.health.values()],
      divergencePct: this.divergencePct(),
      updatedAt: new Date().toISOString(),
    };
  }

  isDiverged(): boolean {
    const d = this.divergencePct();
    return d !== null && d > MAX_DIVERGENCE_WARN;
  }
}

// Per-process singleton (web app on-demand path + workers).
const globalForAgg = globalThis as unknown as { __pipulseAgg?: Aggregator };

export function getAggregator(): Aggregator {
  if (!globalForAgg.__pipulseAgg) {
    globalForAgg.__pipulseAgg = new Aggregator();
  }
  return globalForAgg.__pipulseAgg;
}
