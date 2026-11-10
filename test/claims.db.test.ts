/** Claims, sign-in, profile editing and message delivery against a real database. Needs TEST_DATABASE_URL. */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "@/db/client";
import { claimRequests, contactRequests, extractedFacts, firms, profiles } from "@/db/schema";
import { approveClaim, rejectClaim, startClaim, verifyClaim } from "@/claims";
import { saveCoreForm } from "@/advisor";
import { submitContact } from "@/directory/profiles";
import { loadCandidates } from "@/matching/load";
import { outbox } from "@/email";
import { resetDb } from "./db-helpers";

const url = process.env.TEST_DATABASE_URL;
const flags = (flat: boolean) => ({ pctAum: !flat, hourly: false, subscription: false, fixed: flat, commissions: false, performance: false, other: !flat });
const lastCode = (to: string) => {
  const mail = [...outbox].reverse().find((m) => m.to === to && /code/i.test(m.subject));
  return mail?.text.match(/\b(\d{6})\b/)?.[1] ?? "";
};
const person = (crd: number, email: string) => ({ crd, email, name: "Jo Planner", role: "Founder" });

describe.skipIf(!url)("claims (database)", () => {
  const { db, pool } = url ? createDb(url) : ({} as ReturnType<typeof createDb>);

  beforeAll(async () => {
    process.env.ADMIN_EMAIL = "owner@flatfee.test";
    await resetDb(db);
    const [listed] = await db.insert(firms).values({ crd: 600001, name: "Listed Planning", website: "https://www.listedplanning.com", feeFlags: flags(true), flatFeeCandidate: true }).returning();
    await db.insert(profiles).values({ firmId: listed.id, displayName: "Listed Planning", slug: "listed-planning-600001" });
    await db.insert(firms).values({ crd: 600002, name: "Other Fee Advice", website: "otherfee.com", feeFlags: flags(false), flatFeeCandidate: false });
  });
  beforeEach(() => void outbox.splice(0));
  afterAll(async () => pool?.end());

  it("approves at once when the email matches the firm's website, then the advisor can fill in the short form", async () => {
    const id = (await startClaim(db, person(600001, "jo@listedplanning.com")))!;
    expect(await verifyClaim(db, id, "000000".replace(/0/g, () => "9"))).toEqual({ status: "bad_code" });
    const outcome = await verifyClaim(db, id, lastCode("jo@listedplanning.com"));
    expect(outcome.status).toBe("approved");

    const [profile] = await db.select().from(profiles).where(eq(profiles.slug, "listed-planning-600001"));
    expect(profile).toMatchObject({ tier: "claimed", ownerUserId: outcome.userId });

    const form = { feeMin: 3000, feeMax: 6000, offeringModels: ["advice_only"], meetingFormats: ["virtual"], topServices: ["tax_planning"], assetMinimum: undefined };
    await expect(saveCoreForm(db, "00000000-0000-0000-0000-000000000000", profile.id, form)).rejects.toThrow(/Not your profile/);
    await saveCoreForm(db, outcome.userId!, profile.id, form);
    await saveCoreForm(db, outcome.userId!, profile.id, { ...form, feeMax: 7000 });
    const facts = await db.select().from(extractedFacts).where(eq(extractedFacts.profileId, profile.id));
    expect(facts.find((f) => f.fieldKey === "annual_fee_range")?.value).toEqual({ min: 3000, max: 7000 });
    expect(facts.filter((f) => f.fieldKey === "annual_fee_range")).toHaveLength(1);
    expect(facts.every((f) => f.status === "confirmed" && f.source === "advisor_form")).toBe(true);

    await submitContact(db, "listed-planning-600001", { email: "pat@example.com", message: "Hi, I would like help planning my retirement." });
    const delivered = outbox.find((m) => m.to === "jo@listedplanning.com" && m.replyTo === "pat@example.com");
    expect(delivered?.text).toContain("planning my retirement");
    const [contact] = await db.select().from(contactRequests);
    expect(contact.deliveredAt).not.toBeNull();
  });

  it("sends anything else to review; approving lists a firm that had no listing", async () => {
    const id = (await startClaim(db, person(600002, "jo@gmail.com")))!;
    const outcome = await verifyClaim(db, id, lastCode("jo@gmail.com"));
    expect(outcome.status).toBe("pending_review");
    expect(outbox.some((m) => m.to === "owner@flatfee.test")).toBe(true);
    expect(await loadCandidates(db)).toHaveLength(1);

    const { slug } = await approveClaim(db, id);
    expect(slug).toBe("other-fee-advice-600002");
    const [profile] = await db.select().from(profiles).where(eq(profiles.slug, slug));
    expect(profile).toMatchObject({ tier: "claimed", ownerUserId: outcome.userId });
    // A claimed profile is listed and matchable even though its ADV fee type was "other".
    expect(await loadCandidates(db)).toHaveLength(2);
  });

  it("can't approve a firm missing from the SEC data or hand a listing to a second person", async () => {
    const missing = (await startClaim(db, person(600099, "new@newfirm.com")))!;
    await verifyClaim(db, missing, lastCode("new@newfirm.com"));
    await expect(approveClaim(db, missing)).rejects.toThrow(/isn't in the SEC data yet/);

    const second = (await startClaim(db, person(600001, "rival@gmail.com")))!;
    await verifyClaim(db, second, lastCode("rival@gmail.com"));
    await expect(approveClaim(db, second)).rejects.toThrow(/already owns/);
    await rejectClaim(db, second);
    const [row] = await db.select().from(claimRequests).where(eq(claimRequests.id, second));
    expect(row.status).toBe("rejected");
  });

  it("locks a code after too many wrong tries", async () => {
    const id = (await startClaim(db, person(600001, "x@listedplanning.com")))!;
    const code = lastCode("x@listedplanning.com");
    const wrong = code === "123456" ? "654321" : "123456";
    for (let i = 0; i < 5; i++) expect((await verifyClaim(db, id, wrong)).status).toBe("bad_code");
    expect((await verifyClaim(db, id, code)).status).toBe("bad_code");
  });
});
