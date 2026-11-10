import { passesFilters } from "./filters";
import { scoreCandidate } from "./score";
import type { AdvisorCandidate, Constraints, FilterReason, MatchResult, ProspectAnswers, ScoredCandidate } from "./types";

export const MATCH_COUNT = 3;
/** Scores within this distance are treated as a tie and rotated. */
export const TIE_EPSILON = 0.01;
/** Slots 2 and 3 may pick for variety from candidates within this share of the top score. */
export const VARIETY_BAND = 0.85;

export type MatchOptions = {
  /** Seeds tie rotation, so ties rotate across prospects but stay stable within a session. */
  sessionId: string;
  /** Times each profile was matched this week in the prospect's region. */
  exposureCounts?: Record<string, number>;
  /** Profiles at or over this are skipped unless needed to fill 3 slots. */
  exposureCap?: number;
};

/** FNV-1a: a small, stable hash for tie-break rotation. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rank(list: ScoredCandidate[], sessionId: string): ScoredCandidate[] {
  return [...list].sort((x, y) => {
    if (Math.abs(x.score - y.score) > TIE_EPSILON) return y.score - x.score;
    return hash(sessionId + x.candidate.profileId) - hash(sessionId + y.candidate.profileId);
  });
}

const feeBucket = (s: ScoredCandidate) => {
  const r = s.candidate.facts.annual_fee_range;
  return r ? Math.floor(((r.min + r.max) / 2) / 2500) : null;
};
const meetingKey = (s: ScoredCandidate) => (s.candidate.facts.meeting_formats ?? []).slice().sort().join("+") || null;

/** Does this candidate differ from everything already picked on price or meeting style? */
function addsVariety(s: ScoredCandidate, picked: ScoredCandidate[]): boolean {
  const fb = feeBucket(s);
  const mk = meetingKey(s);
  return picked.every((p) => (fb !== null && fb !== feeBucket(p)) || (mk !== null && mk !== meetingKey(p)));
}

function pickWithVariety(ranked: ScoredCandidate[], count: number): ScoredCandidate[] {
  const picked: ScoredCandidate[] = [];
  const pool = [...ranked];
  if (!pool.length) return picked;
  picked.push(pool.shift()!);
  const floor = picked[0].score * VARIETY_BAND;
  while (picked.length < count && pool.length) {
    const i = pool.findIndex((s) => s.score >= floor && addsVariety(s, picked));
    picked.push(pool.splice(i >= 0 ? i : 0, 1)[0]);
  }
  return picked;
}

const REASON_TEXT: Record<string, string> = {
  semantic: "Their answers closely match what you described",
  life_events: "Specializes in the life event you're facing",
  services: "Strongest in the help you asked for",
  typical_assets: "Typically works with clients at your asset level",
  involvement: "Works the way you want to be involved",
  distance: "Office is near you",
  cadence: "Meets as often as you'd like",
  tax_depth: "Does in-depth tax planning",
  values: "Shares what matters to you in an advisor",
  budget_fit: "Fee fits your budget",
  firm_size: "Firm size fits what you asked for",
};

/** Placeholder reasons from the top-scoring facets. Phase 3 replaces these with quotes from the advisor's own answers. */
function reasonsFor(s: ScoredCandidate): string[] {
  return s.breakdown
    .filter((b) => b.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((b) => REASON_TEXT[b.facet]);
}

export type MatchRun = {
  matches: MatchResult[];
  /** Why each filtered-out claimed advisor missed (feeds the "missed matches" metric). */
  filteredOut: { profileId: string; reason: FilterReason }[];
};

/**
 * Pick 3 advisors. Claimed profiles (free or paid, scored identically) fill
 * the slots first. Only if fewer than 3 claimed advisors pass the filters do
 * unclaimed listings fill the rest, flagged as fallback.
 */
export function findMatches(candidates: AdvisorCandidate[], prospect: ProspectAnswers, constraints: Constraints, opts: MatchOptions): MatchRun {
  const filteredOut: MatchRun["filteredOut"] = [];
  const passing: ScoredCandidate[] = [];
  for (const c of candidates) {
    const r = passesFilters(c, prospect, constraints);
    if (r.pass) passing.push(scoreCandidate(c, prospect, constraints));
    else if (c.claimed) filteredOut.push({ profileId: c.profileId, reason: r.reason });
  }

  const cap = opts.exposureCap;
  const overCap = (s: ScoredCandidate) => cap !== undefined && (opts.exposureCounts?.[s.candidate.profileId] ?? 0) >= cap;

  const rankedClaimed = rank(passing.filter((s) => s.candidate.claimed), opts.sessionId);
  // Over-cap profiles go to the back rather than out, so a thin region still gets 3.
  const claimedOrdered = [...rankedClaimed.filter((s) => !overCap(s)), ...rankedClaimed.filter(overCap)];
  const picked = pickWithVariety(claimedOrdered, MATCH_COUNT);

  const fallback = rank(passing.filter((s) => !s.candidate.claimed), opts.sessionId).slice(0, MATCH_COUNT - picked.length);

  const matches: MatchResult[] = [...picked.map((s) => ({ s, fb: false })), ...fallback.map((s) => ({ s, fb: true }))].map(({ s, fb }, i) => ({
    profileId: s.candidate.profileId,
    rank: i + 1,
    score: s.score,
    breakdown: s.breakdown,
    isUnclaimedFallback: fb,
    reasons: reasonsFor(s),
  }));
  return { matches, filteredOut };
}
