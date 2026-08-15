/**
 * Signal persistence. INSERT-only by design: there are no UPDATE or DELETE
 * statements in this file, and the DB triggers would reject them anyway.
 */
import { getDb, toIso, toIsoOrNull, toNumOrNull, toNum, type Db } from "@/lib/db";
import { deriveOutcome } from "@/lib/signals/outcome";
import type {
  Direction,
  SignalEventRow,
  SignalEventType,
  SignalRow,
  SignalWithOutcome,
} from "@/lib/signals/types";

function mapSignal(row: Record<string, unknown>): SignalRow {
  return {
    id: String(row.id),
    symbol: String(row.symbol),
    direction: String(row.direction) as Direction,
    entry: toNum(row.entry),
    stop: toNum(row.stop),
    target: toNum(row.target),
    rationale: String(row.rationale ?? ""),
    issuedAt: toIso(row.issued_at),
    expiresAt: toIsoOrNull(row.expires_at),
    visibleFrom: toIsoOrNull(row.visible_from),
    source: String(row.source) as SignalRow["source"],
    isTest: Boolean(row.is_test),
    createdAt: toIso(row.created_at),
  };
}

function mapEvent(row: Record<string, unknown>): SignalEventRow {
  return {
    id: String(row.id),
    signalId: String(row.signal_id),
    type: String(row.type) as SignalEventType,
    price: toNumOrNull(row.price),
    priceSource: row.price_source === null || row.price_source === undefined ? null : String(row.price_source),
    note: String(row.note ?? ""),
    occurredAt: toIso(row.occurred_at),
  };
}

export interface NewSignal {
  symbol: string;
  direction: Direction;
  entry: number;
  stop: number;
  target: number;
  rationale: string;
  issuedAt?: string;
  expiresAt?: string | null;
  visibleFrom?: string | null;
  source?: SignalRow["source"];
  isTest?: boolean;
}

export async function createSignal(input: NewSignal, db?: Db): Promise<SignalRow> {
  const d = db ?? (await getDb());
  const { rows } = await d.query(
    `INSERT INTO signals (symbol, direction, entry, stop, target, rationale, issued_at, expires_at, visible_from, source, is_test)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      input.symbol,
      input.direction,
      input.entry,
      input.stop,
      input.target,
      input.rationale,
      input.issuedAt ?? new Date().toISOString(),
      input.expiresAt ?? null,
      input.visibleFrom ?? null,
      input.source ?? "manual",
      input.isTest ?? false,
    ]
  );
  const signal = mapSignal(rows[0]!);
  await insertEvent(
    {
      signalId: signal.id,
      type: "published",
      price: null,
      priceSource: null,
      note: "",
      occurredAt: signal.issuedAt,
    },
    d
  );
  return signal;
}

export interface NewEvent {
  signalId: string;
  type: SignalEventType;
  price: number | null;
  priceSource: string | null;
  note: string;
  occurredAt?: string;
}

/**
 * Append an event. For terminal events the partial unique index guarantees
 * only the first close wins; a duplicate insert throws and the caller treats
 * it as "already closed".
 */
export async function insertEvent(input: NewEvent, db?: Db): Promise<SignalEventRow> {
  const d = db ?? (await getDb());
  const { rows } = await d.query(
    `INSERT INTO signal_events (signal_id, type, price, price_source, note, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.signalId,
      input.type,
      input.price,
      input.priceSource,
      input.note,
      input.occurredAt ?? new Date().toISOString(),
    ]
  );
  return mapEvent(rows[0]!);
}

export interface ListOptions {
  symbol?: string;
  /** Max rows, or `null` for the complete history (used by performance). */
  limit?: number | null;
  includeTest?: boolean;
}

export async function listSignalsWithOutcomes(
  opts: ListOptions = {},
  db?: Db
): Promise<SignalWithOutcome[]> {
  const d = db ?? (await getDb());
  const params: unknown[] = [];
  const where: string[] = [];
  if (opts.symbol) {
    params.push(opts.symbol);
    where.push(`symbol = $${params.length}`);
  }
  if (!opts.includeTest) {
    where.push(`is_test = false`);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  // `limit: null` means the complete history. Performance statistics MUST use
  // it: a capped read would silently drop the oldest signals and make the
  // performance page disagree with the feed about what the record contains.
  let limitSql = "";
  if (opts.limit !== null) {
    params.push(Math.max(1, opts.limit ?? 200));
    limitSql = ` LIMIT $${params.length}`;
  }
  const { rows } = await d.query(
    `SELECT * FROM signals ${whereSql} ORDER BY issued_at DESC${limitSql}`,
    params
  );
  const signals = rows.map(mapSignal);
  if (signals.length === 0) return [];

  const ids = signals.map((s) => s.id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const eventsRes = await d.query(
    `SELECT * FROM signal_events WHERE signal_id IN (${placeholders}) ORDER BY occurred_at ASC`,
    ids
  );
  const eventsBySignal = new Map<string, SignalEventRow[]>();
  for (const raw of eventsRes.rows) {
    const ev = mapEvent(raw);
    const list = eventsBySignal.get(ev.signalId) ?? [];
    list.push(ev);
    eventsBySignal.set(ev.signalId, list);
  }
  return signals.map((s) => deriveOutcome(s, eventsBySignal.get(s.id) ?? []));
}

export async function getSignalWithOutcome(id: string, db?: Db): Promise<SignalWithOutcome | null> {
  const d = db ?? (await getDb());
  const { rows } = await d.query(`SELECT * FROM signals WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  const signal = mapSignal(rows[0]);
  const eventsRes = await d.query(
    `SELECT * FROM signal_events WHERE signal_id = $1 ORDER BY occurred_at ASC`,
    [id]
  );
  return deriveOutcome(signal, eventsRes.rows.map(mapEvent));
}

/**
 * Signals with no terminal event yet (the resolver's work queue), each
 * carrying whether its entry has already filled so the resolver knows which
 * leg of the lifecycle it is on.
 */
export async function listOpenSignals(
  symbol: string | undefined,
  db?: Db
): Promise<(SignalRow & { filled: boolean })[]> {
  const d = db ?? (await getDb());
  const params: unknown[] = [];
  let symbolSql = "";
  if (symbol) {
    params.push(symbol);
    symbolSql = `AND s.symbol = $1`;
  }
  const { rows } = await d.query(
    `SELECT s.*,
            EXISTS (
              SELECT 1 FROM signal_events f
              WHERE f.signal_id = s.id AND f.type = 'filled'
            ) AS filled
     FROM signals s
     WHERE NOT EXISTS (
       SELECT 1 FROM signal_events e
       WHERE e.signal_id = s.id
         AND e.type IN ('hit_tp', 'hit_sl', 'expired', 'manual_close')
     ) ${symbolSql}
     ORDER BY s.issued_at ASC`,
    params
  );
  return rows.map((r) => ({ ...mapSignal(r), filled: Boolean(r.filled) }));
}
