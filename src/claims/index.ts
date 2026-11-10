/**
 * Free claims and "Get listed" requests.
 *
 * 1. The advisor gives their firm's CRD (or starts from a listing), name, role
 *    and work email, and gets a code by email.
 * 2. Entering the code proves they own the email. If its domain matches the
 *    firm's website and the listing is unclaimed, the claim is approved at once.
 * 3. Anything else (no domain match, no listing yet, firm not in the SEC data
 *    yet, listing already claimed) waits for the site owner at /admin/claims.
 */
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { claimRequests, firms, profiles, users } from "@/db/schema";
import { slugFor } from "@/adv/import";
import { findOrCreateUser, normalizeEmail, sendCode, verifyCode } from "@/auth";
import { sendEmail, siteUrl } from "@/email";
import { hostOf, isNotFirmWebsite } from "@/adv/web";

/** Webmail domains never count as a firm's own domain. */
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "aol.com",
  "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "zoho.com", "yandex.com",
]);
/** Hosted-site builders: the site may be the firm's, but the domain isn't. */
const SITE_BUILDERS = /(^|\.)(wixsite\.com|squarespace\.com|godaddysites\.com|wordpress\.com|weebly\.com)$/;

/** True when the email's domain is the firm's own website domain (or a subdomain of it). */
export function emailMatchesWebsite(email: string, website: string | null): boolean {
  const domain = normalizeEmail(email).split("@")[1];
  if (!domain || FREE_MAIL.has(domain) || !website) return false;
  const host = hostOf(website);
  if (!host || isNotFirmWebsite(website) || SITE_BUILDERS.test(host)) return false;
  return domain === host || domain.endsWith(`.${host}`) || host.endsWith(`.${domain}`);
}

export const claimSchema = z.object({
  crd: z.coerce.number({ message: "Please enter your firm's CRD number." }).int().positive("Please enter your firm's CRD number.").max(99_999_999, "That doesn't look like a CRD number."),
  name: z.string().trim().min(2, "Please enter your name.").max(120),
  role: z.string().trim().min(2, "Please enter your role at the firm.").max(120),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(254),
  note: z.string().trim().max(1000).optional(),
});
export type ClaimInput = z.infer<typeof claimSchema>;

/** Record the request and email a code. Returns null if this email asked for too many codes. */
export async function startClaim(db: Db, input: ClaimInput): Promise<string | null> {
  const [firm] = await db.select().from(firms).where(eq(firms.crd, input.crd));
  const [profile] = firm ? await db.select().from(profiles).where(eq(profiles.firmId, firm.id)).limit(1) : [];
  const [request] = await db
    .insert(claimRequests)
    .values({
      crd: input.crd,
      profileId: profile?.id ?? null,
      email: input.email,
      name: input.name,
      role: input.role,
      note: input.note || null,
      domainMatch: emailMatchesWebsite(input.email, firm?.website ?? null),
    })
    .returning();
  const sent = await sendCode(db, input.email, "confirm your email for Flat Fee Network");
  return sent ? request.id : null;
}

export type ClaimOutcome = { status: "approved" | "pending_review" | "bad_code"; userId?: string; slug?: string };

/** Check the emailed code, then approve or queue the claim. */
export async function verifyClaim(db: Db, requestId: string, code: string): Promise<ClaimOutcome> {
  const [request] = await db.select().from(claimRequests).where(eq(claimRequests.id, requestId));
  if (!request || request.status !== "awaiting_code") return { status: "bad_code" };
  if (!(await verifyCode(db, request.email, code))) return { status: "bad_code" };

  const user = await findOrCreateUser(db, request.email, request.name);
  await db.update(claimRequests).set({ userId: user.id, status: "pending_review" }).where(eq(claimRequests.id, request.id));

  const [profile] = request.profileId ? await db.select().from(profiles).where(eq(profiles.id, request.profileId)) : [];
  if (request.domainMatch && profile && profile.tier === "unclaimed") {
    const approved = await approveClaim(db, request.id);
    return { status: "approved", userId: user.id, slug: approved.slug };
  }

  const admin = process.env.ADMIN_EMAIL;
  if (admin) {
    await sendEmail({
      to: admin,
      subject: `Claim to review: CRD ${request.crd}`,
      text: `${request.name} (${request.role}, ${request.email}) asked to claim CRD ${request.crd}.\n\nReview it at ${siteUrl()}/admin/claims`,
    });
  }
  return { status: "pending_review", userId: user.id };
}

/**
 * Give the claimant the listing. Creates the listing if the firm has none
 * (for example a flat fee filed as "other"). Fails if the firm isn't in the
 * SEC data yet or someone else already owns the listing.
 */
export async function approveClaim(db: Db, requestId: string): Promise<{ slug: string }> {
  return db.transaction(async (tx) => {
    const [request] = await tx.select().from(claimRequests).where(eq(claimRequests.id, requestId)).for("update");
    if (!request || request.status !== "pending_review" || !request.userId) throw new Error("This request can't be approved");
    const [firm] = await tx.select().from(firms).where(eq(firms.crd, request.crd));
    if (!firm) throw new Error(`CRD ${request.crd} isn't in the SEC data yet. Try again after the next import.`);

    let [profile] = await tx.select().from(profiles).where(eq(profiles.firmId, firm.id)).limit(1).for("update");
    if (profile?.ownerUserId && profile.ownerUserId !== request.userId) throw new Error("Someone else already owns this listing");
    if (profile) {
      [profile] = await tx
        .update(profiles)
        .set({ ownerUserId: request.userId, tier: profile.tier === "paid" ? "paid" : "claimed", claimedAt: profile.claimedAt ?? new Date(), isLive: true, updatedAt: new Date() })
        .where(eq(profiles.id, profile.id))
        .returning();
    } else {
      [profile] = await tx
        .insert(profiles)
        .values({ firmId: firm.id, ownerUserId: request.userId, tier: "claimed", claimedAt: new Date(), displayName: firm.name, slug: slugFor(firm) })
        .returning();
    }
    await tx.update(claimRequests).set({ status: "approved", profileId: profile.id, decidedAt: new Date() }).where(eq(claimRequests.id, request.id));
    await sendEmail({
      to: request.email,
      subject: "Your Flat Fee Network profile is yours",
      text: `You now manage ${profile.displayName} on Flat Fee Network.\n\nSign in at ${siteUrl()}/advisor to add your fees and services so prospects can be matched with you.`,
    });
    return { slug: profile.slug };
  });
}

export async function rejectClaim(db: Db, requestId: string) {
  const [request] = await db
    .update(claimRequests)
    .set({ status: "rejected", decidedAt: new Date() })
    .where(and(eq(claimRequests.id, requestId), eq(claimRequests.status, "pending_review")))
    .returning();
  if (request) {
    await sendEmail({
      to: request.email,
      subject: "About your Flat Fee Network claim",
      text: `We couldn't confirm that you represent CRD ${request.crd}, so we didn't approve this claim.\n\nIf you think that's a mistake, reply to this email from your firm's email address.`,
    });
  }
}

export async function pendingClaims(db: Db) {
  return db
    .select({ request: claimRequests, firmName: firms.name, firmWebsite: firms.website, listed: profiles.id, ownerEmail: users.email })
    .from(claimRequests)
    .leftJoin(firms, eq(firms.crd, claimRequests.crd))
    .leftJoin(profiles, eq(profiles.firmId, firms.id))
    .leftJoin(users, eq(users.id, profiles.ownerUserId))
    .where(eq(claimRequests.status, "pending_review"))
    .orderBy(desc(claimRequests.createdAt));
}
