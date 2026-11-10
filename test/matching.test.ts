import { describe, expect, it } from "vitest";
import { applyPassReason, emptyConstraints, findMatches, passesFilters, scoreCandidate, showMore, type AdvisorCandidate, type ProspectAnswers } from "@/matching";

const prospect = (over: Partial<ProspectAnswers> = {}): ProspectAnswers => ({
  lifeEvents: ["retiring_soon"],
  state: "TX",
  meeting: "either",
  services: ["retirement_income", "tax_planning"],
  assets: "1m_3m",
  budget: "6k_10k",
  involvement: "collaborate",
  cadence: "quarterly",
  values: [],
  mustHaveValues: [],
  ...over,
});

const advisor = (id: string, over: Partial<AdvisorCandidate> = {}): AdvisorCandidate => ({
  profileId: id,
  claimed: true,
  facts: {
    annual_fee_range: { min: 6000, max: 8000 },
    offering_models: ["advice_only"],
    meeting_formats: ["virtual"],
    top_services: ["retirement_income", "tax_planning"],
    life_event_specialties: ["retiring_soon"],
    typical_asset_range: ["1m_3m"],
    involvement_style: ["collaborate"],
    meeting_cadence: ["quarterly"],
    tax_depth: 3,
  },
  ...over,
});

const none = emptyConstraints();

describe("hard filters", () => {
  it("never filters on the advisor's registration state", () => {
    // Nothing about where the advisor is registered is even an input; a TX prospect matches anyone.
    expect(passesFilters(advisor("a"), prospect({ state: "TX" }), none).pass).toBe(true);
  });

  it("respects states an advisor isn't taking new clients in", () => {
    const a = advisor("a", { facts: { ...advisor("a").facts, excluded_states: ["TX"] } });
    expect(passesFilters(a, prospect(), none)).toEqual({ pass: false, reason: "state_excluded" });
  });

  it("allows a 20% stretch over the budget ceiling", () => {
    const fee = (min: number) => advisor("a", { facts: { ...advisor("a").facts, annual_fee_range: { min, max: min + 1000 } } });
    expect(passesFilters(fee(11_900), prospect(), none).pass).toBe(true); // ceiling 10k * 1.2
    expect(passesFilters(fee(12_100), prospect(), none).pass).toBe(false);
    expect(passesFilters(fee(50_000), prospect({ budget: "not_sure" }), none).pass).toBe(true);
  });

  it("matches advisors offering both models for either request", () => {
    const both = advisor("b", { facts: { ...advisor("b").facts, offering_models: ["advice_only", "investment_management"] } });
    const adviceOnly = advisor("a");
    expect(passesFilters(both, prospect({ offering: "advice_only" }), none).pass).toBe(true);
    expect(passesFilters(both, prospect({ offering: "investment_management" }), none).pass).toBe(true);
    expect(passesFilters(adviceOnly, prospect({ offering: "investment_management" }), none)).toEqual({ pass: false, reason: "offering_model" });
    expect(passesFilters(adviceOnly, prospect({ offering: "not_sure" }), none).pass).toBe(true);
  });

  it("filters on minimums against the top of the prospect's range", () => {
    const min = (m: number) => advisor("a", { facts: { ...advisor("a").facts, asset_minimum: m } });
    expect(passesFilters(min(3_000_000), prospect(), none).pass).toBe(true);
    expect(passesFilters(min(5_000_000), prospect(), none).pass).toBe(false);
  });

  it("uses distance only when in person is required", () => {
    const austin = { lat: 30.27, lng: -97.74 };
    const dallas = { lat: 32.78, lng: -96.8 };
    const far = advisor("a", { officeLocation: dallas, facts: { ...advisor("a").facts, meeting_formats: ["virtual", "in_person"] } });
    expect(passesFilters(far, prospect({ location: austin }), none).pass).toBe(true);
    expect(passesFilters(far, prospect({ location: austin }), { ...none, inPersonRequired: true })).toEqual({ pass: false, reason: "too_far" });
  });

  it("never fails a filter for missing data, except a must-have", () => {
    const sparse = advisor("a", { facts: {} });
    expect(passesFilters(sparse, prospect({ offering: "advice_only" }), none).pass).toBe(true);
    expect(passesFilters(sparse, prospect({ mustHaveValues: ["woman_advisor"] }), none)).toEqual({ pass: false, reason: "missing_must_have" });
  });
});

describe("fit score", () => {
  it("gives identical scores to a paid and a free profile with identical facts", () => {
    // Tier is not part of AdvisorCandidate at all; claimed is the only status and both are claimed.
    const paid = advisor("paid");
    const free = advisor("free");
    expect(scoreCandidate(paid, prospect(), none).score).toBe(scoreCandidate(free, prospect(), none).score);
  });

  it("gives missing data no credit but no penalty", () => {
    const full = scoreCandidate(advisor("a"), prospect(), none);
    const sparse = scoreCandidate(advisor("b", { facts: {} }), prospect(), none);
    expect(sparse.score).toBe(0);
    expect(sparse.breakdown.every((b) => b.points === 0)).toBe(true);
    expect(full.score).toBeGreaterThan(sparse.score);
  });

  it("records every applicable facet in the breakdown", () => {
    const { breakdown } = scoreCandidate(advisor("a"), prospect(), none);
    expect(breakdown.map((b) => b.facet)).toEqual(expect.arrayContaining(["life_events", "services", "tax_depth", "budget_fit"]));
    expect(breakdown.find((b) => b.facet === "distance")).toBeUndefined(); // prospect is fine with virtual
  });
});

describe("findMatches", () => {
  it("returns 3 claimed matches when enough pass", () => {
    const cands = ["a", "b", "c", "d"].map((id) => advisor(id));
    const { matches } = findMatches(cands, prospect(), none, { sessionId: "s1" });
    expect(matches).toHaveLength(3);
    expect(matches.every((m) => !m.isUnclaimedFallback)).toBe(true);
    expect(matches.map((m) => m.rank)).toEqual([1, 2, 3]);
  });

  it("fills empty slots with unclaimed listings, after every claimed one", () => {
    const strongUnclaimed = advisor("u1", { claimed: false });
    const weakClaimed = advisor("c1", { facts: {} });
    const { matches } = findMatches([strongUnclaimed, weakClaimed, advisor("u2", { claimed: false, facts: {} })], prospect(), none, { sessionId: "s1" });
    expect(matches.map((m) => [m.profileId, m.isUnclaimedFallback])).toEqual([
      ["c1", false],
      ["u1", true],
      ["u2", true],
    ]);
  });

  it("never shows unclaimed listings when 3 claimed advisors pass", () => {
    const cands = [advisor("c1"), advisor("c2"), advisor("c3"), advisor("u1", { claimed: false })];
    expect(findMatches(cands, prospect(), none, { sessionId: "s" }).matches.some((m) => m.isUnclaimedFallback)).toBe(false);
  });

  it("rotates tied advisors across sessions but keeps a session stable", () => {
    const cands = Array.from({ length: 8 }, (_, i) => advisor(`t${i}`));
    const first = (s: string) => findMatches(cands, prospect(), none, { sessionId: s }).matches[0].profileId;
    expect(first("same")).toBe(first("same"));
    const winners = new Set(Array.from({ length: 30 }, (_, i) => first(`session-${i}`)));
    expect(winners.size).toBeGreaterThan(1);
  });

  it("prefers variety in price or meeting style for slots 2 and 3", () => {
    const base = advisor("a").facts;
    const cands = [
      advisor("top", { semanticSimilarity: 1 }),
      advisor("same1", { semanticSimilarity: 0.95 }),
      advisor("same2", { semanticSimilarity: 0.94 }),
      advisor("diff", { semanticSimilarity: 0.9, facts: { ...base, annual_fee_range: { min: 9000, max: 10000 } } }),
    ];
    const ids = findMatches(cands, prospect(), none, { sessionId: "s" }).matches.map((m) => m.profileId);
    expect(ids[0]).toBe("top");
    expect(ids).toContain("diff");
  });

  it("moves over-exposed advisors behind others but still uses them to fill", () => {
    const cands = [advisor("busy", { semanticSimilarity: 1 }), advisor("b"), advisor("c")];
    const ids = findMatches(cands, prospect(), none, { sessionId: "s", exposureCounts: { busy: 50 }, exposureCap: 20 }).matches.map((m) => m.profileId);
    expect(ids[0]).not.toBe("busy");
    expect(ids).toContain("busy");
  });

  it("reports why claimed advisors were filtered out", () => {
    const pricey = advisor("p", { facts: { ...advisor("p").facts, annual_fee_range: { min: 20000, max: 25000 } } });
    expect(findMatches([pricey], prospect(), none, { sessionId: "s" }).filteredOut).toEqual([{ profileId: "p", reason: "over_budget" }]);
  });
});

describe("feedback", () => {
  it("'fee too high' lowers the ceiling below that advisor's fee", () => {
    const a = advisor("a");
    const next = applyPassReason(none, "fee_too_high", a);
    expect(next.excludedProfileIds).toEqual(["a"]);
    const sameFee = advisor("b");
    expect(passesFilters(sameFee, prospect(), next).pass).toBe(false);
  });

  it("'want in person' makes in person a requirement", () => {
    const next = applyPassReason(none, "want_in_person", advisor("a"));
    expect(next.inPersonRequired).toBe(true);
    expect(passesFilters(advisor("b"), prospect(), next)).toEqual({ pass: false, reason: "no_in_person" });
  });

  it("'show me 3 more' excludes everyone already shown", () => {
    const cands = ["a", "b", "c", "d"].map((id) => advisor(id));
    const first = findMatches(cands, prospect(), none, { sessionId: "s" }).matches.map((m) => m.profileId);
    const next = findMatches(cands, prospect(), showMore(none, first), { sessionId: "s" }).matches.map((m) => m.profileId);
    expect(next.some((id) => first.includes(id))).toBe(false);
  });
});
