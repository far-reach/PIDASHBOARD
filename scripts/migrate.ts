/** Apply pending migrations. Usage: npm run db:migrate */
import { createDb, migrate } from "../src/lib/db";

async function main(): Promise<void> {
  const db = await createDb({ migrate: false });
  const applied = await migrate(db);
  console.log(
    applied.length > 0 ? `applied: ${applied.join(", ")}` : "no pending migrations — schema is current"
  );
  await db.close();
}

main().catch((err) => {
  console.error("migration failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
