/**
 * Tiny cross-process state store on top of the `kv` table.
 * The ingest worker writes feed state here; the web app reads it. When a
 * shared Redis is configured the hot path uses Redis instead (see cache.ts),
 * but the kv table is always written so /api/health works with db alone.
 */
import { getDb, toIso } from "@/lib/db";

export async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO kv (k, v, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
}

export async function kvGet<T>(key: string): Promise<{ value: T; updatedAt: string } | null> {
  const db = await getDb();
  const { rows } = await db.query<{ v: unknown; updated_at: unknown }>(
    `SELECT v, updated_at FROM kv WHERE k = $1`,
    [key]
  );
  const row = rows[0];
  if (!row) return null;
  const raw = row.v;
  const value = (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
  return { value, updatedAt: toIso(row.updated_at) };
}
