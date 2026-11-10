"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { parseQuestionnaireForm } from "@/prospect/answers";
import { nextRound, recordFeedback, startSession } from "@/prospect/session";
import { vocabKeys } from "@/taxonomy/vocab";

export type QuestionnaireState = { errors?: Record<string, string> };

export async function submitQuestionnaire(_prev: QuestionnaireState, form: FormData): Promise<QuestionnaireState> {
  const parsed = parseQuestionnaireForm(form);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message.startsWith("Invalid") || issue.code === "too_small" ? "Please answer this question." : issue.message;
    return { errors };
  }
  const sessionId = await startSession(getDb(), parsed.data);
  redirect(`/match/${sessionId}`);
}

const UUID = /^[0-9a-f-]{36}$/i;

export async function reactToMatch(form: FormData) {
  const sessionId = String(form.get("sessionId"));
  const matchId = String(form.get("matchId"));
  const kind = String(form.get("kind"));
  const reason = form.get("reason") ? String(form.get("reason")) : undefined;
  if (!UUID.test(sessionId) || !UUID.test(matchId)) throw new Error("Bad request");
  if (kind !== "interested" && kind !== "not_for_me") throw new Error("Bad request");
  if (reason && !vocabKeys("pass_reasons").includes(reason)) throw new Error("Bad request");
  await recordFeedback(getDb(), sessionId, matchId, kind, reason);
  redirect(`/match/${sessionId}`);
}

export async function showNextMatches(form: FormData) {
  const sessionId = String(form.get("sessionId"));
  if (!UUID.test(sessionId)) throw new Error("Bad request");
  await nextRound(getDb(), sessionId);
  redirect(`/match/${sessionId}`);
}
