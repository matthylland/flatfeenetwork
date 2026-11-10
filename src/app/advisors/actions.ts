"use server";

import { getDb } from "@/db";
import { contactSchema, submitContact } from "@/directory/profiles";

export type ContactState = { sent?: boolean; errors?: { email?: string; message?: string; form?: string } };

const UUID = /^[0-9a-f-]{36}$/i;
const optionalId = (v: FormDataEntryValue | null) => (v && UUID.test(String(v)) ? String(v) : undefined);

export async function sendContact(_prev: ContactState, form: FormData): Promise<ContactState> {
  const parsed = contactSchema.safeParse({ email: form.get("email"), message: form.get("message") });
  if (!parsed.success) {
    const errors: ContactState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as "email" | "message";
      errors[key] ??= issue.message;
    }
    return { errors };
  }
  try {
    await submitContact(getDb(), String(form.get("slug")), parsed.data, { matchId: optionalId(form.get("matchId")), sessionId: optionalId(form.get("sessionId")) });
  } catch {
    return { errors: { form: "Sorry, we couldn't send that. Please try again." } };
  }
  return { sent: true };
}
