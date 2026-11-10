/**
 * Runs against a real Postgres with pgvector. Skipped unless TEST_DATABASE_URL
 * is set; it migrates that database and imports the sample feed twice.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { firms, profiles } from "@/db/schema";
import { importAdvFeed } from "@/adv/import";
import { resetDb } from "./db-helpers";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("importAdvFeed (database)", () => {
  const { db, pool } = url ? createDb(url) : ({} as ReturnType<typeof createDb>);

  beforeAll(async () => {
    await resetDb(db);
  });
  afterAll(async () => pool?.end());

  it("upserts firms and creates one unclaimed listing per flat-fee firm, idempotently", async () => {
    const first = await importAdvFeed(db, "test/fixtures/adv-sample.xml");
    expect(first).toMatchObject({ seen: 4, upserted: 3, listingsCreated: 1 });
    expect(first.errors).toHaveLength(1);

    const second = await importAdvFeed(db, "test/fixtures/adv-sample.xml");
    expect(second).toMatchObject({ upserted: 3, listingsCreated: 0 });

    expect(await db.select().from(firms)).toHaveLength(3);
    const listings = await db.select().from(profiles);
    expect(listings).toHaveLength(1);
    expect(listings.every((l) => l.tier === "unclaimed")).toBe(true);

    const [aumOnly] = await db.select().from(firms).where(eq(firms.crd, 100003));
    expect(aumOnly.flatFeeCandidate).toBe(false);
  });

  it("skips a firm the database rejects and still loads the rest of the batch", async () => {
    const r = await importAdvFeed(db, "test/fixtures/adv-bad-values.xml");
    expect(r).toMatchObject({ seen: 3, upserted: 2, listingsCreated: 2 });
    expect(r.errors).toEqual([expect.stringMatching(/^CRD 99999999999: .*out of range/)]);
    const [big] = await db.select().from(firms).where(eq(firms.crd, 200001));
    expect(big).toMatchObject({ clientCount: null, assetsUnderManagement: 2356471235 });
  });
});
