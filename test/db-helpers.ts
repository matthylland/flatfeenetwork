import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Db } from "@/db/client";

/** Migrate, then empty every table. Database tests only ever run against a throwaway database. */
export async function resetDb(db: Db) {
  await migrate(db, { migrationsFolder: "./drizzle" });
  const { rows } = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public'`);
  if (rows.length) await db.execute(sql.raw(`truncate ${rows.map((r) => `"${r.tablename}"`).join(", ")} restart identity cascade`));
}
