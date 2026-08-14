/**
 * Database adapter.
 *
 * Production: PostgreSQL via DATABASE_URL (Neon / Supabase / Railway).
 * Dev & test: embedded PGlite (real Postgres compiled to WASM) — same SQL,
 * same triggers, zero setup. File-backed under .data/pglite by default,
 * in-memory when `memory: true` (tests).
 */
import fs from "node:fs";
import path from "node:path";

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
}

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  close(): Promise<void>;
  readonly kind: "pg" | "pglite";
}

export interface CreateDbOptions {
  /** Force an in-memory PGlite instance (used by tests). */
  memory?: boolean;
  /** Override the Postgres connection string. */
  databaseUrl?: string;
  /** Directory for the file-backed PGlite database. */
  pgliteDir?: string;
  /** Run pending migrations immediately (default true). */
  migrate?: boolean;
}

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

async function createPgDb(databaseUrl: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: databaseUrl, max: 10 });
  return {
    kind: "pg",
    async query<T>(sql: string, params?: unknown[]) {
      const res = await pool.query(sql, params as unknown[]);
      return { rows: res.rows as T[] };
    },
    async close() {
      await pool.end();
    },
  };
}

async function createPgliteDb(opts: { memory?: boolean; dir?: string }): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  let pg: InstanceType<typeof PGlite>;
  if (opts.memory) {
    pg = new PGlite();
  } else {
    const dir = opts.dir ?? path.join(process.cwd(), ".data", "pglite");
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    pg = new PGlite(dir);
  }
  return {
    kind: "pglite",
    async query<T>(sql: string, params?: unknown[]) {
      if (params && params.length > 0) {
        const res = await pg.query(sql, params as unknown[]);
        return { rows: res.rows as T[] };
      }
      // No params → use exec, which allows multi-statement scripts (migrations).
      const results = await pg.exec(sql);
      const last = results[results.length - 1];
      return { rows: (last?.rows ?? []) as T[] };
    },
    async close() {
      await pg.close();
    },
  };
}

/** Apply db/migrations/*.sql in filename order, tracked in schema_migrations. */
export async function migrate(db: Db, migrationsDir: string = MIGRATIONS_DIR): Promise<string[]> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`
  );
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const { rows } = await db.query<{ name: string }>(`SELECT name FROM schema_migrations`);
  const done = new Set(rows.map((r) => r.name));
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    await db.query(sql);
    await db.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [file]);
    applied.push(file);
  }
  return applied;
}

export async function createDb(opts: CreateDbOptions = {}): Promise<Db> {
  const url = opts.databaseUrl ?? process.env.DATABASE_URL;
  const db =
    !opts.memory && url
      ? await createPgDb(url)
      : await createPgliteDb({ memory: opts.memory, dir: opts.pgliteDir ?? process.env.PGLITE_DIR });
  if (opts.migrate !== false) {
    await migrate(db);
  }
  return db;
}

// Singleton for the app / workers. Survives Next.js dev hot-reload via globalThis.
const globalForDb = globalThis as unknown as { __pipulseDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!globalForDb.__pipulseDb) {
    globalForDb.__pipulseDb = createDb();
  }
  return globalForDb.__pipulseDb;
}

// ── Row coercion helpers ────────────────────────────────────────────────────
// pg returns numeric as string and timestamptz as Date; PGlite returns
// numeric as string/number and timestamptz as Date/string depending on
// version. Normalize at the edge so the rest of the code sees numbers + ISO.

export function toNum(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  return typeof v === "number" ? v : Number(v);
}

export function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = toNum(v);
  return Number.isFinite(n) ? n : null;
}

export function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return new Date(String(v)).toISOString();
}

export function toIsoOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return toIso(v);
}
