/** Browse, profile and contact against a real database. Needs TEST_DATABASE_URL. */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { contactRequests, firms, profileEvents, profiles } from "@/db/schema";
import { getProfile, PAGE_SIZE, recordProfileView, searchProfiles, submitContact } from "@/directory/profiles";
import { currentMatches, startSession } from "@/prospect/session";
import { questionnaireSchema } from "@/prospect/answers";
import { resetDb } from "./db-helpers";

const url = process.env.TEST_DATABASE_URL;
const flags = (flat: boolean) => ({ pctAum: !flat, hourly: false, subscription: false, fixed: flat, commissions: false, performance: false, other: false });

describe.skipIf(!url)("directory (database)", () => {
  const { db, pool } = url ? createDb(url) : ({} as ReturnType<typeof createDb>);

  beforeAll(async () => {
    await resetDb(db);
    const add = async (crd: number, name: string, city: string, tier: "unclaimed" | "claimed", flat = true, isLive = true) => {
      const [firm] = await db.insert(firms).values({ crd, name, city, state: "TX", feeFlags: flags(flat), flatFeeCandidate: flat }).returning();
      await db.insert(profiles).values({ firmId: firm.id, displayName: name, slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${crd}`, tier, isLive });
    };
    await add(700001, "Zeta Planning", "Austin", "claimed");
    await add(700002, "Alpha 100% Advice", "Dallas", "unclaimed");
    await add(700003, "AUM Only Co", "Austin", "unclaimed", false);
    await add(700004, "Hidden Planning", "Austin", "claimed", true, false);
    for (let i = 0; i < PAGE_SIZE; i++) await add(710000 + i, `Bulk Firm ${String(i).padStart(2, "0")}`, "Reno", "unclaimed");
  });
  afterAll(async () => pool?.end());

  it("searches by name, city and CRD, sorted by name, hiding non-flat-fee and offline listings", async () => {
    const austin = await searchProfiles(db, "austin");
    expect(austin.rows.map((r) => r.displayName)).toEqual(["Zeta Planning"]);
    expect((await searchProfiles(db, "700002")).rows.map((r) => r.displayName)).toEqual(["Alpha 100% Advice"]);
    expect((await searchProfiles(db, "100%")).total).toBe(1);
    expect((await searchProfiles(db, "%")).total).toBe(1); // a literal %, not a wildcard

    const all = await searchProfiles(db, "");
    expect(all.total).toBe(PAGE_SIZE + 2);
    expect(all.pages).toBe(2);
    expect(all.rows[0].displayName).toBe("Alpha 100% Advice");
    const second = await searchProfiles(db, "", 2);
    expect(second.rows.map((r) => r.displayName)).toEqual(["Bulk Firm 24", "Zeta Planning"]);
  });

  it("only returns visible profiles", async () => {
    expect(await getProfile(db, "zeta-planning-700001")).not.toBeNull();
    expect(await getProfile(db, "aum-only-co-700003")).toBeNull();
    expect(await getProfile(db, "hidden-planning-700004")).toBeNull();
  });

  it("stores contact only for claimed profiles and credits a match only when it is real", async () => {
    const msg = { email: "pat@example.com", message: "Hello, I am retiring next year and want a plan." };
    await expect(submitContact(db, "alpha-100-advice-700002", msg)).rejects.toThrow(/claimed/);

    const q = questionnaireSchema.parse({
      p_life_event: ["want_a_plan"], p_zip: "78701", p_meeting: "either", p_services: ["cash_flow_budgeting"],
      p_assets: "250k_1m", p_budget: "3k_6k", p_involvement: "learn_diy", p_cadence: "annual_semiannual",
    });
    const sessionId = await startSession(db, q);
    const card = (await currentMatches(db, sessionId))!.cards.find((c) => c.profile.slug === "zeta-planning-700001")!;
    expect(card).toBeDefined();

    await submitContact(db, "zeta-planning-700001", msg, { matchId: card.match.id, sessionId });
    const [saved] = await db.select().from(contactRequests);
    expect(saved).toMatchObject({ matchId: card.match.id, sessionId, prospectEmail: "pat@example.com" });

    // A match id from someone else's session is ignored, not trusted.
    const other = await startSession(db, q);
    await recordProfileView(db, card.profile.id, { matchId: card.match.id, sessionId: other });
    const views = await db.select().from(profileEvents).where(eq(profileEvents.kind, "profile_view"));
    expect(views).toHaveLength(1);
    expect(views[0].sessionId).toBeNull();
  });
});
