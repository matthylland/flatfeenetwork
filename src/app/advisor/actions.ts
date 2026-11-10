"use server";

import { redirect } from "next/navigation";
import { and, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { normalizeEmail, sendCode, verifyCode } from "@/auth";
import { coreFormSchema, saveCoreForm } from "@/advisor";
import { currentUser, signIn, signOut } from "@/web/session";

export type SignInState = { step: "email" | "code"; email?: string; error?: string };

export async function signInStep(prev: SignInState, form: FormData): Promise<SignInState> {
  const db = getDb();
  if (prev.step === "email") {
    const email = normalizeEmail(String(form.get("email") ?? ""));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { step: "email", error: "Please enter a valid email address." };
    // Only advisors with an account get a code, but the reply is the same either way.
    const [user] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`);
    if (user && !(await sendCode(db, email))) return { step: "email", error: "Too many codes were sent to this address. Please try again in an hour." };
    return { step: "code", email };
  }
  const email = prev.email ?? "";
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  const [user] = await db.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${email}`));
  if (!user || code.length !== 6 || !(await verifyCode(db, email, code))) return { step: "code", email, error: "That code didn't work." };
  await signIn(user.id);
  redirect("/advisor");
}

export async function signOutAction() {
  await signOut();
  redirect("/");
}

export type ProfileFormState = { saved?: boolean; errors?: Record<string, string> };

export async function saveProfile(_prev: ProfileFormState, form: FormData): Promise<ProfileFormState> {
  const user = await currentUser();
  if (!user) redirect("/advisor/sign-in");
  const parsed = coreFormSchema.safeParse({
    feeMin: form.get("feeMin"),
    feeMax: form.get("feeMax"),
    feeCovers: form.get("feeCovers") || undefined,
    offeringModels: form.getAll("offeringModels").map(String),
    meetingFormats: form.getAll("meetingFormats").map(String),
    topServices: form.getAll("topServices").map(String),
    assetMinimum: form.get("assetMinimum"),
    intro: form.get("intro") || undefined,
    bookingUrl: form.get("bookingUrl") || undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors };
  }
  const profileId = String(form.get("profileId"));
  if (!/^[0-9a-f-]{36}$/i.test(profileId)) return { errors: { form: "Something went wrong. Please reload." } };
  try {
    await saveCoreForm(getDb(), user.id, profileId, parsed.data);
  } catch {
    return { errors: { form: "Couldn't save. Please reload and try again." } };
  }
  return { saved: true };
}
