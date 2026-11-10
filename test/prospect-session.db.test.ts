/** End-to-end prospect flow against a real database. Needs TEST_DATABASE_URL. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { extractedFacts, firms, profiles } from "@/db/schema";
import { currentMatches, nextRound, recordFeedback, startSession } from "@/prospect/session";
import { questionnaireSchema } from "@/prospect/answers";
import { resetDb } from "./db-helpers";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("prospect session (database)", () => {
  const { db, pool } = url ? createDb(url) : ({} as ReturnType<typeof createDb>);
  const flags = { pctAum: false, hourly: false, subscription: false, fixed: true, commissions: false, performance: false, other: false };

  beforeAll(async () => {
    await resetDb(db);
    for (let i = 0; i < 4; i++) {
      const [firm] = await db.insert(firms).values({ crd: 800000 + i, name: `Test Firm ${i}`, feeFlags: flags, flatFeeCandidate: true }).returning();
      const [p] = await db.insert(profiles).values({ firmId: firm.id, displayName: firm.name, slug: `test-${firm.crd}`, tier: "claimed" }).returning();
      await db.insert(extractedFacts).values({ profileId: p.id, fieldKey: "annual_fee_range", value: { min: 3000 + i * 1000, max: 4000 + i * 1000 }, taxonomyVersion: 1, source: "advisor_form", status: "confirmed" });
    }
  });
  afterAll(async () => pool?.end());

  it("matches, records feedback, and builds the next round without repeats", async () => {
    const q = questionnaireSchema.parse({
      p_life_event: ["want_a_plan"], p_zip: "43215", p_meeting: "either", p_services: ["cash_flow_budgeting"],
      p_assets: "250k_1m", p_budget: "3k_6k", p_involvement: "learn_diy", p_cadence: "annual_semiannual",
    });
    const sessionId = await startSession(db, q);
    const first = await currentMatches(db, sessionId);
    expect(first?.round).toBe(1);
    expect(first?.cards).toHaveLength(3);

    await recordFeedback(db, sessionId, first!.cards[0].match.id, "not_for_me", "fee_too_high");
    await nextRound(db, sessionId);
    const second = await currentMatches(db, sessionId);
    expect(second?.round).toBe(2);
    const firstIds = first!.cards.map((c) => c.profile.id);
    expect(second!.cards.some((c) => firstIds.includes(c.profile.id))).toBe(false);
  });
});
