/**
 * Passwordless sign-in for advisors: a 6-digit code by email, then a session
 * token in a cookie. Codes and tokens are stored only as hashes.
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { emailCodes, users, userSessions } from "@/db/schema";
import { sendEmail } from "@/email";

export const CODE_TTL_MINUTES = 15;
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_CODES_PER_HOUR = 5;
export const SESSION_DAYS = 30;
export const SESSION_COOKIE = "ffn_session";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const codeHash = (email: string, code: string) => sha256(`${email.toLowerCase()}:${code}`);
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** Email a sign-in code. Returns false when this address asked for too many codes recently. */
export async function sendCode(db: Db, rawEmail: string, purpose = "sign in to Flat Fee Network"): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  const [{ recent }] = await db
    .select({ recent: sql<number>`count(*)::int` })
    .from(emailCodes)
    .where(and(eq(emailCodes.email, email), gt(emailCodes.createdAt, sql`now() - interval '1 hour'`)));
  if (recent >= MAX_CODES_PER_HOUR) return false;
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(emailCodes).values({ email, codeHash: codeHash(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000) });
  await sendEmail({
    to: email,
    subject: `Your Flat Fee Network code: ${code}`,
    text: `Your code to ${purpose} is ${code}.\n\nIt expires in ${CODE_TTL_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`,
  });
  return true;
}

/** Check a code against the newest unused one for this email. Each code allows a few attempts. */
export async function verifyCode(db: Db, rawEmail: string, code: string): Promise<boolean> {
  const email = normalizeEmail(rawEmail);
  const [row] = await db
    .select()
    .from(emailCodes)
    .where(and(eq(emailCodes.email, email), isNull(emailCodes.usedAt), gt(emailCodes.expiresAt, new Date())))
    .orderBy(desc(emailCodes.createdAt))
    .limit(1);
  if (!row || row.attempts >= MAX_CODE_ATTEMPTS) return false;
  const expected = Buffer.from(row.codeHash);
  const given = Buffer.from(codeHash(email, code.trim()));
  const ok = expected.length === given.length && timingSafeEqual(expected, given);
  await db
    .update(emailCodes)
    .set(ok ? { usedAt: new Date() } : { attempts: sql`${emailCodes.attempts} + 1` })
    .where(eq(emailCodes.id, row.id));
  return ok;
}

export async function findOrCreateUser(db: Db, rawEmail: string, name?: string) {
  const email = normalizeEmail(rawEmail);
  const [existing] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
  if (existing) return existing;
  const [created] = await db.insert(users).values({ email, name: name ?? null }).returning();
  return created;
}

export async function createSession(db: Db, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(userSessions).values({ tokenHash: sha256(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function userForSession(db: Db, token: string | undefined) {
  if (!token) return null;
  const [row] = await db
    .select({ user: users })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(and(eq(userSessions.tokenHash, sha256(token)), gt(userSessions.expiresAt, new Date())));
  return row?.user ?? null;
}

export async function endSession(db: Db, token: string | undefined) {
  if (token) await db.delete(userSessions).where(eq(userSessions.tokenHash, sha256(token)));
}

/** The site owner, who reviews claims. */
export const isAdmin = (user: { email: string } | null) => {
  const admin = process.env.ADMIN_EMAIL;
  return !!user && !!admin && normalizeEmail(user.email) === normalizeEmail(admin);
};
