/**
 * Import Form ADV firm data.
 *
 *   npm run import:adv -- <path-or-url> [<path-or-url> ...]
 *
 * Pass both the SEC-registered and state-registered firm feeds. Railway runs
 * this monthly as a cron job.
 */
import { createDb } from "../src/db/client";
import { importAdvFeed } from "../src/adv/import";

async function main() {
  const sources = process.argv.slice(2);
  if (!sources.length) throw new Error("Usage: import-adv <path-or-url> [...]");
  const { db, pool } = createDb();
  try {
    for (const source of sources) {
      const r = await importAdvFeed(db, source);
      console.log(`${source}: ${r.seen} firms seen, ${r.upserted} upserted, ${r.listingsCreated} new listings, ${r.errors.length} errors`);
      for (const e of r.errors.slice(0, 10)) console.warn(`  ${e}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
