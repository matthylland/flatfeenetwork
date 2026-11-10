"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { claimSchema, startClaim, verifyClaim } from "@/claims";
import { signIn } from "@/web/session";

export type ClaimFormState = { errors?: Record<string, string> };

export async function submitClaim(_prev: ClaimFormState, form: FormData): Promise<ClaimFormState> {
  const parsed = claimSchema.safeParse({
    crd: form.get("crd"),
    name: form.get("name"),
    role: form.get("role"),
    email: form.get("email"),
    note: form.get("note") || undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { errors };
  }
  const requestId = await startClaim(getDb(), parsed.data);
  if (!requestId) return { errors: { email: "Too many codes were sent to this address. Please try again in an hour." } };
  redirect(`/claim/verify?r=${requestId}`);
}

export type VerifyState = { error?: string };

export async function submitClaimCode(_prev: VerifyState, form: FormData): Promise<VerifyState> {
  const requestId = String(form.get("requestId"));
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (!/^[0-9a-f-]{36}$/i.test(requestId) || code.length !== 6) return { error: "Please enter the 6-digit code from the email." };
  const outcome = await verifyClaim(getDb(), requestId, code);
  if (outcome.status === "bad_code") return { error: "That code didn't work. Check the email, or start again for a new code." };
  await signIn(outcome.userId!);
  redirect(outcome.status === "approved" ? "/advisor?claimed=1" : "/advisor?pending=1");
}
