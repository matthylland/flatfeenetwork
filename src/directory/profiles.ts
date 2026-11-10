/**
 * Browse, search and profile pages. Ordering is neutral: by name, never by
 * tier. Only live listings of flat-fee firms are shown.
 */
import { and, asc, count, eq, ilike, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { contactRequests, extractedFacts, firms, matches, matchSets, profileEvents, profiles, users } from "@/db/schema";
import { sendEmail, siteUrl } from "@/email";

export const PAGE_SIZE = 25;

/**
 * Who appears anywhere on the site: live listings of firms that file a flat
 * fee on Form ADV, plus any claimed profile (claims are approved by an email
 * domain match or by hand, which covers firms that filed their flat fee as "other").
 */
export const listedWhere = and(eq(profiles.isLive, true), or(eq(firms.flatFeeCandidate, true), ne(profiles.tier, "unclaimed")))!;
const visible = listedWhere;

/** Escape LIKE wildcards so a search for "100%" means the literal text. */
const likeText = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export type SearchResult = Awaited<ReturnType<typeof searchProfiles>>;

/** Search by firm or advisor name, city, or CRD number. An empty query lists everyone. */
export async function searchProfiles(db: Db, query: string, page = 1) {
  const q = query.trim().slice(0, 100);
  let where: SQL | undefined = visible;
  if (q) {
    const terms: SQL[] = [ilike(profiles.displayName, likeText(q)), ilike(firms.name, likeText(q)), ilike(firms.legalName, likeText(q)), ilike(firms.city, likeText(q))];
    if (/^\d{1,9}$/.test(q)) terms.push(eq(firms.crd, Number(q)));
    where = and(visible, or(...terms));
  }
  const current = Math.max(1, Math.floor(page) || 1);
  const [{ total }] = await db.select({ total: count() }).from(profiles).innerJoin(firms, eq(firms.id, profiles.firmId)).where(where);
  const rows = await db
    .select({
      slug: profiles.slug,
      displayName: profiles.displayName,
      tier: profiles.tier,
      city: firms.city,
      state: firms.state,
      feeFlags: firms.feeFlags,
    })
    .from(profiles)
    .innerJoin(firms, eq(firms.id, profiles.firmId))
    .where(where)
    .orderBy(asc(sql`lower(${profiles.displayName})`), asc(profiles.slug))
    .limit(PAGE_SIZE)
    .offset((current - 1) * PAGE_SIZE);
  return { rows, total, page: current, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** One profile with its firm and confirmed facts, or null if it isn't shown. */
export async function getProfile(db: Db, slug: string) {
  const [row] = await db
    .select({ profile: profiles, firm: firms })
    .from(profiles)
    .innerJoin(firms, eq(firms.id, profiles.firmId))
    .where(and(eq(profiles.slug, slug), visible));
  if (!row) return null;
  const facts = await db
    .select({ fieldKey: extractedFacts.fieldKey, value: extractedFacts.value })
    .from(extractedFacts)
    .where(and(eq(extractedFacts.profileId, row.profile.id), eq(extractedFacts.status, "confirmed")));
  return { ...row, facts: Object.fromEntries(facts.map((f) => [f.fieldKey, f.value])) as Record<string, unknown> };
}

/** Advisors can receive messages only once someone has claimed the listing. */
export const canReceiveMessages = (tier: string) => tier !== "unclaimed";

/**
 * A match only counts as the source of a view or contact if it really was
 * this profile's match in that session; otherwise the link is ignored.
 */
async function verifiedMatch(db: Db, profileId: string, matchId?: string, sessionId?: string) {
  if (!matchId || !sessionId) return null;
  const [m] = await db
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(matchSets, eq(matchSets.id, matches.matchSetId))
    .where(and(eq(matches.id, matchId), eq(matches.profileId, profileId), eq(matchSets.sessionId, sessionId)));
  return m ? { matchId: m.id, sessionId } : null;
}

export async function recordProfileView(db: Db, profileId: string, from?: { matchId?: string; sessionId?: string }) {
  const source = await verifiedMatch(db, profileId, from?.matchId, from?.sessionId);
  await db.insert(profileEvents).values({ profileId, kind: "profile_view", sessionId: source?.sessionId ?? null, detail: source ? { matchId: source.matchId } : null });
}

export const contactSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(254),
  message: z.string().trim().min(20, "Please write at least a sentence or two.").max(3000, "Please keep it under 3,000 characters."),
});

export type ContactInput = z.infer<typeof contactSchema>;

/**
 * Store a prospect's message to an advisor, count it for analytics, and
 * email it to the advisor with the prospect as reply-to.
 */
export async function submitContact(db: Db, slug: string, input: ContactInput, from?: { matchId?: string; sessionId?: string }) {
  const found = await getProfile(db, slug);
  if (!found) throw new Error("Profile not found");
  if (!canReceiveMessages(found.profile.tier)) throw new Error("This advisor hasn't claimed their profile yet");
  const source = await verifiedMatch(db, found.profile.id, from?.matchId, from?.sessionId);
  const saved = await db.transaction(async (tx) => {
    const [row] = await tx.insert(contactRequests).values({
      profileId: found.profile.id,
      sessionId: source?.sessionId ?? null,
      matchId: source?.matchId ?? null,
      prospectEmail: input.email,
      message: input.message,
    }).returning();
    await tx.insert(profileEvents).values({ profileId: found.profile.id, kind: "contact", sessionId: source?.sessionId ?? null, detail: source ? { matchId: source.matchId } : null });
    return row;
  });

  // The message is saved either way; a failed send leaves delivered_at empty to retry later.
  const [owner] = found.profile.ownerUserId ? await db.select({ email: users.email }).from(users).where(eq(users.id, found.profile.ownerUserId)) : [];
  if (!owner) return;
  try {
    await sendEmail({
      to: owner.email,
      replyTo: input.email,
      subject: `New message from a prospect on Flat Fee Network`,
      text: `${input.message}\n\n---\nFrom: ${input.email}\nReply to this email to answer them directly.\nSent through your profile: ${siteUrl()}/advisors/${found.profile.slug}`,
    });
    await db.update(contactRequests).set({ deliveredAt: new Date() }).where(eq(contactRequests.id, saved.id));
  } catch (err) {
    console.error(`contact ${saved.id} not delivered:`, err);
  }
}

/** The fee types a firm filed on Form ADV, in plain words. */
export function advFeeTypes(f: { fixed: boolean; hourly: boolean; subscription: boolean; pctAum: boolean }) {
  return [f.fixed && "Fixed fees", f.hourly && "Hourly fees", f.subscription && "Subscription fees", f.pctAum && "Also charges a percentage of assets"].filter(
    (x): x is string => !!x,
  );
}
