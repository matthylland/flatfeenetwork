/**
 * Question sets, kept in code and versioned. Stored answers record
 * `questionKey` + `questionVersion`, so a prompt can be reworded (bump the
 * version) without breaking older answers.
 */
import type { VocabularyName } from "@/taxonomy/vocab";

export type ProspectQuestion = {
  key: string;
  version: number;
  prompt: string;
  answer:
    | { kind: "pick"; vocab: VocabularyName; max?: number }
    | { kind: "zip" }
    | { kind: "free_text"; allowVoice: boolean };
  optional?: boolean;
  /** Shown only when an earlier answer calls for it. */
  showIf?: { questionKey: string; includesAny: string[] };
};

export const PROSPECT_QUESTIONS: ProspectQuestion[] = [
  { key: "p_life_event", version: 1, prompt: "What's prompting you to look for an advisor now?", answer: { kind: "pick", vocab: "life_events", max: 2 } },
  { key: "p_zip", version: 1, prompt: "Where do you live?", answer: { kind: "zip" } },
  { key: "p_meeting", version: 1, prompt: "How do you want to meet?", answer: { kind: "pick", vocab: "prospect_meeting_wants", max: 1 } },
  { key: "p_services", version: 1, prompt: "What do you want help with?", answer: { kind: "pick", vocab: "services" } },
  { key: "p_offering", version: 1, prompt: "Do you want them to manage your accounts, or only advise?", answer: { kind: "pick", vocab: "prospect_offering_wants", max: 1 }, showIf: { questionKey: "p_services", includesAny: ["investment_management"] } },
  { key: "p_assets", version: 1, prompt: "Roughly how much do you have invested?", answer: { kind: "pick", vocab: "asset_ranges", max: 1 } },
  { key: "p_income", version: 1, prompt: "What's your household income?", answer: { kind: "pick", vocab: "income_ranges", max: 1 }, optional: true },
  { key: "p_budget", version: 1, prompt: "What annual fee feels reasonable for the help you want?", answer: { kind: "pick", vocab: "fee_budgets", max: 1 } },
  { key: "p_involvement", version: 1, prompt: "How involved do you want to be?", answer: { kind: "pick", vocab: "involvement", max: 1 } },
  { key: "p_cadence", version: 1, prompt: "How often do you want to hear from them?", answer: { kind: "pick", vocab: "cadence", max: 1 } },
  { key: "p_values", version: 1, prompt: "Anything that matters to you in an advisor?", answer: { kind: "pick", vocab: "values_prefs" }, optional: true },
  { key: "p_own_words", version: 1, prompt: "In your own words, what's your situation and what would a great advisor do for you?", answer: { kind: "free_text", allowVoice: true }, optional: true },
];

export type AdvisorQuestion = {
  key: string;
  version: number;
  prompt: string;
  /** One-line coaching shown under the prompt. */
  tip?: string;
  /** Fields the extractor should try to fill from this answer. */
  targetFields: string[];
};

export type Chapter = { key: string; title: string; questions: AdvisorQuestion[] };

/** Paid-tier onboarding. Answered by video (default), audio only, or typing. */
export const PAID_CHAPTERS: Chapter[] = [
  {
    key: "who_you_serve",
    title: "Who you serve",
    questions: [
      { key: "a_intro", version: 1, prompt: "Introduce yourself in about 30 seconds.", tip: "This warm-up becomes your profile intro clip.", targetFields: [] },
      { key: "a_ideal_client", version: 1, prompt: "Describe your ideal client, and one you'd turn away.", tip: "Picture one real client you've helped.", targetFields: ["ideal_client", "client_exclusions", "typical_asset_range", "typical_income_range", "life_event_specialties", "top_niches"] },
      { key: "a_specialties", version: 1, prompt: "Pick two situations you handle unusually well and describe a real, anonymized case.", tip: "Leave out names and identifying details.", targetFields: ["specialty_situations", "life_event_specialties", "top_services"] },
    ],
  },
  {
    key: "how_you_work",
    title: "How you work",
    questions: [
      { key: "a_year_one", version: 1, prompt: "Walk through what a client gets in year one, then year two onward.", targetFields: ["deliverables", "meeting_cadence", "onboarding_length_weeks"] },
      { key: "a_involvement", version: 1, prompt: "How involved do your clients tend to be?", targetFields: ["involvement_style"] },
      { key: "a_access", version: 1, prompt: "How do clients reach you between meetings, and how fast do you respond?", targetFields: ["access_channels", "response_time_hours"] },
    ],
  },
  {
    key: "money_and_method",
    title: "Fees and expertise",
    questions: [
      { key: "a_fee", version: 1, prompt: "How is your fee set, and what makes it go up?", tip: "Give real dollar amounts if you can.", targetFields: ["fee_drivers", "annual_fee_range", "fee_structures"] },
      { key: "a_investing", version: 1, prompt: "How do you invest client money, and why?", targetFields: ["investment_philosophy", "uses_tax_loss_harvesting", "uses_direct_indexing", "offering_models"] },
      { key: "a_tax", version: 1, prompt: "How deep does your tax work go? Do you prepare returns?", targetFields: ["tax_depth", "prepares_returns"] },
    ],
  },
  {
    key: "fit_and_trust",
    title: "Fit and trust",
    questions: [
      { key: "a_clients_like", version: 1, prompt: "What do clients most often say they like about working with you?", targetFields: ["personality_tags", "values_signals", "languages"] },
      { key: "a_continuity", version: 1, prompt: "What happens to clients if you retire or are unavailable?", targetFields: ["continuity_plan"] },
      { key: "a_anything_else", version: 1, prompt: "Anything a prospect should know that doesn't fit elsewhere?", targetFields: [] },
    ],
  },
];

export const PAID_QUESTIONS: AdvisorQuestion[] = PAID_CHAPTERS.flatMap((c) => c.questions);
