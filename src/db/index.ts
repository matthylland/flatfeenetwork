import { createDb, type Db } from "./client";

const globalForDb = globalThis as unknown as { __db?: Db };

/** One pool per server process (survives hot reloads in dev). */
export function getDb(): Db {
  if (!globalForDb.__db) globalForDb.__db = createDb().db;
  return globalForDb.__db;
}
