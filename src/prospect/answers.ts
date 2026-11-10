import { z } from "zod";
import { vocabKeys } from "@/taxonomy/vocab";
import type { ProspectAnswers } from "@/matching";
import { stateFromZip } from "./zip";

const one = (v: Parameters<typeof vocabKeys>[0]) => z.enum(vocabKeys(v) as [string, ...string[]]);
const many = (v: Parameters<typeof vocabKeys>[0]) => z.array(one(v));

/** Raw questionnaire submission, keyed by question key. */
export const questionnaireSchema = z.object({
  p_life_event: many("life_events").min(1).max(2),
  p_zip: z.string().regex(/^\d{5}$/, "Enter a 5-digit ZIP code"),
  p_meeting: one("prospect_meeting_wants"),
  p_meeting_required: z.boolean().default(false),
  p_services: many("services").min(1),
  p_offering: one("prospect_offering_wants").optional(),
  p_assets: one("asset_ranges"),
  p_income: one("income_ranges").optional(),
  p_budget: one("fee_budgets"),
  p_involvement: one("involvement"),
  p_cadence: one("cadence"),
  p_values: many("values_prefs").default([]),
  p_values_must: many("values_prefs").default([]),
  p_own_words: z.string().max(3000).optional(),
});

export type Questionnaire = z.infer<typeof questionnaireSchema>;

/** Read a submitted form. Multi-selects arrive as repeated fields. */
export function parseQuestionnaireForm(form: FormData) {
  const all = (k: string) => form.getAll(k).map(String).filter(Boolean);
  const opt = (k: string) => {
    const v = form.get(k);
    return v ? String(v) : undefined;
  };
  const services = all("p_services");
  return questionnaireSchema.safeParse({
    p_life_event: all("p_life_event"),
    p_zip: String(form.get("p_zip") ?? "").trim(),
    p_meeting: opt("p_meeting"),
    p_meeting_required: form.get("p_meeting_required") === "on",
    p_services: services,
    // The offering question only applies when they want investment help.
    p_offering: services.includes("investment_management") ? opt("p_offering") : undefined,
    p_assets: opt("p_assets"),
    p_income: opt("p_income"),
    p_budget: opt("p_budget"),
    p_involvement: opt("p_involvement"),
    p_cadence: opt("p_cadence"),
    p_values: all("p_values"),
    p_values_must: all("p_values_must"),
    p_own_words: opt("p_own_words")?.trim() || undefined,
  });
}

export function toProspectAnswers(q: Questionnaire): ProspectAnswers {
  return {
    lifeEvents: q.p_life_event,
    state: stateFromZip(q.p_zip),
    meeting: q.p_meeting as ProspectAnswers["meeting"],
    services: q.p_services,
    offering: q.p_offering as ProspectAnswers["offering"],
    assets: q.p_assets,
    income: q.p_income,
    budget: q.p_budget,
    involvement: q.p_involvement,
    cadence: q.p_cadence,
    // A must-have is also a preference.
    values: [...new Set([...q.p_values, ...q.p_values_must])],
    mustHaveValues: q.p_values_must,
  };
}

/** Constraints implied by the answers themselves, before any feedback. */
export function initialConstraints(q: Questionnaire) {
  return {
    excludedProfileIds: [] as string[],
    inPersonRequired: q.p_meeting === "in_person_preferred" && q.p_meeting_required,
  };
}
