import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { extractedFacts, feedbackEvents, firms, matches, matchSets, profileEvents, profiles, prospectAnswers, prospectSessions } from "@/db/schema";
import { applyPassReason, findMatches, SCORER_VERSION, showMore, type Constraints, type ProspectAnswers } from "@/matching";
import { loadCandidates } from "@/matching/load";
import { PROSPECT_QUESTIONS } from "@/questions";
import { initialConstraints, toProspectAnswers, type Questionnaire } from "./answers";

const questionVersion = (key: string) => PROSPECT_QUESTIONS.find((q) => q.key === key)?.version ?? 1;

/** Save a questionnaire, run the first round of matches, return the session id. */
export async function startSession(db: Db, q: Questionnaire): Promise<string> {
  const [session] = await db.insert(prospectSessions).values({ zip: q.p_zip }).returning();
  await db.insert(prospectAnswers).values(
    Object.entries(q)
      .filter(([, v]) => v !== undefined)
      .map(([key, value]) => ({ sessionId: session.id, questionKey: key, questionVersion: questionVersion(key), value })),
  );
  await runRound(db, session.id, toProspectAnswers(q), initialConstraints(q), 1);
  return session.id;
}

async function runRound(db: Db, sessionId: string, prospect: ProspectAnswers, constraints: Constraints, round: number) {
  const candidates = await loadCandidates(db);
  const { matches: picked, filteredOut } = findMatches(candidates, prospect, constraints, { sessionId });

  await db.transaction(async (tx) => {
    const [set] = await tx
      .insert(matchSets)
      .values({ sessionId, round, constraints: { prospect, constraints }, scorerVersion: SCORER_VERSION })
      .returning();
    if (picked.length) {
      await tx.insert(matches).values(
        picked.map((m) => ({
          matchSetId: set.id,
          profileId: m.profileId,
          rank: m.rank,
          score: m.score,
          scoreBreakdown: m.breakdown,
          explanation: { reasons: m.reasons },
          isUnclaimedFallback: m.isUnclaimedFallback,
        })),
      );
      await tx.insert(profileEvents).values(picked.map((m) => ({ profileId: m.profileId, kind: "matched" as const, sessionId })));
    }
    if (filteredOut.length) {
      await tx.insert(profileEvents).values(
        filteredOut.map((f) => ({ profileId: f.profileId, kind: "missed_match" as const, sessionId, detail: { reason: f.reason } })),
      );
    }
  });
}

async function latestSet(db: Db, sessionId: string) {
  const [set] = await db.select().from(matchSets).where(eq(matchSets.sessionId, sessionId)).orderBy(desc(matchSets.round)).limit(1);
  return set;
}

/** The current round's matches, with what a match card shows. */
export async function currentMatches(db: Db, sessionId: string) {
  const set = await latestSet(db, sessionId);
  if (!set) return null;
  const rows = await db
    .select({ match: matches, profile: profiles, firm: firms })
    .from(matches)
    .innerJoin(profiles, eq(profiles.id, matches.profileId))
    .innerJoin(firms, eq(firms.id, profiles.firmId))
    .where(eq(matches.matchSetId, set.id))
    .orderBy(matches.rank);
  const feedback = rows.length
    ? await db.select().from(feedbackEvents).where(inArray(feedbackEvents.matchId, rows.map((r) => r.match.id)))
    : [];
  const fees = rows.length
    ? await db
        .select({ profileId: extractedFacts.profileId, value: extractedFacts.value })
        .from(extractedFacts)
        .where(and(inArray(extractedFacts.profileId, rows.map((r) => r.profile.id)), eq(extractedFacts.fieldKey, "annual_fee_range"), eq(extractedFacts.status, "confirmed")))
    : [];
  const feeByProfile = new Map(fees.map((f) => [f.profileId, f.value as { min: number; max: number }]));
  return {
    round: set.round,
    feedback,
    cards: rows.map((r) => ({ ...r, fee: feeByProfile.get(r.profile.id) ?? null })),
  };
}

/** Record a reaction to one match. Nothing re-runs until the prospect asks for the next 3. */
export async function recordFeedback(db: Db, sessionId: string, matchId: string, kind: "interested" | "not_for_me", reason?: string) {
  const set = await latestSet(db, sessionId);
  if (!set) throw new Error("No matches for this session");
  const [match] = await db.select().from(matches).where(and(eq(matches.id, matchId), eq(matches.matchSetId, set.id)));
  if (!match) throw new Error("Match not in the current round");
  await db.insert(feedbackEvents).values({ matchId, kind, reason: kind === "not_for_me" ? (reason ?? "other") : null });
}

/**
 * Build the next 3: apply every "not for me" reason from this round, and
 * exclude everyone already shown (with or without a reason).
 */
export async function nextRound(db: Db, sessionId: string) {
  const set = await latestSet(db, sessionId);
  if (!set) throw new Error("No matches for this session");
  const setMatches = await db.select().from(matches).where(eq(matches.matchSetId, set.id));
  const feedback = setMatches.length
    ? await db.select().from(feedbackEvents).where(inArray(feedbackEvents.matchId, setMatches.map((m) => m.id)))
    : [];
  const { prospect, constraints } = set.constraints as { prospect: ProspectAnswers; constraints: Constraints };

  const candidates = new Map((await loadCandidates(db)).map((c) => [c.profileId, c]));
  let next = showMore(constraints, setMatches.map((m) => m.profileId));
  for (const f of feedback.filter((x) => x.kind === "not_for_me")) {
    const profileId = setMatches.find((m) => m.id === f.matchId)?.profileId;
    const candidate = profileId ? candidates.get(profileId) : undefined;
    if (candidate) next = applyPassReason(next, f.reason ?? "other", candidate);
  }
  await runRound(db, sessionId, prospect, next, set.round + 1);
}

export async function sessionExists(db: Db, sessionId: string) {
  const [s] = await db.select({ id: prospectSessions.id }).from(prospectSessions).where(and(eq(prospectSessions.id, sessionId)));
  return !!s;
}
