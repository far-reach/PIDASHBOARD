import { createDb, type Db } from "@/lib/db";

/** Fresh in-memory PGlite database with the real migrations applied. */
export function createTestDb(): Promise<Db> {
  return createDb({ memory: true });
}
