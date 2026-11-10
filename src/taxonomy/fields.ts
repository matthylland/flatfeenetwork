import { z } from "zod";
import { vocabKeys, type VocabularyName } from "./vocab";

/**
 * The registry of profile facts. Every fact stored in `extracted_facts` has a
 * `fieldKey` from this list, and its value must pass the field's schema.
 *
 * `use` says how matching reads it:
 *  - filter: can remove an advisor outright (hard filter)
 *  - score:  only changes ranking; missing data earns no credit, never a penalty
 *  - display: shown on the profile, not used for matching
 *
 * `confirm` is always "each": Matt decided every fact is confirmed one by one.
 */

export type FieldUse = "filter" | "score" | "display";

export type FieldDef = {
  key: string;
  label: string;
  use: FieldUse;
  /** Which tier first collects it. ADV fields exist even for unclaimed listings. */
  firstTier: "unclaimed" | "claimed" | "paid";
  schema: z.ZodTypeAny;
  vocab?: VocabularyName;
};

const oneOf = (v: VocabularyName) => z.enum(vocabKeys(v) as [string, ...string[]]);
const someOf = (v: VocabularyName, max?: number) => {
  const base = z.array(oneOf(v)).min(1);
  return max ? base.max(max) : base;
};
const usState = z.string().regex(/^[A-Z]{2}$/);
const dollars = z.number().int().nonnegative();

export const FIELDS: FieldDef[] = [
  // From Form ADV (tier 1), confirmed or corrected on claim (tier 2).
  { key: "office_states", label: "Office states", use: "display", firstTier: "unclaimed", schema: z.array(usState) },
  { key: "office_location", label: "Office location (for in-person distance)", use: "score", firstTier: "unclaimed", schema: z.object({ lat: z.number(), lng: z.number(), zip: z.string() }) },
  { key: "fee_structures", label: "Fee structures", use: "filter", firstTier: "unclaimed", vocab: "fee_structures", schema: someOf("fee_structures") },
  { key: "client_count", label: "Number of clients", use: "score", firstTier: "unclaimed", schema: z.number().int().nonnegative() },
  { key: "assets_under_advice", label: "Assets under management or advice", use: "score", firstTier: "unclaimed", schema: dollars },
  { key: "has_disclosures", label: "Disciplinary disclosures", use: "display", firstTier: "unclaimed", schema: z.boolean() },

  // Claimed free tier: the short core set.
  { key: "annual_fee_range", label: "Annual fee range", use: "filter", firstTier: "claimed", schema: z.object({ min: dollars, max: dollars }).refine((r) => r.max >= r.min, "max must be >= min") },
  { key: "onboarding_fee", label: "One-time onboarding fee", use: "display", firstTier: "claimed", schema: dollars },
  { key: "fee_covers", label: "What the fee covers", use: "display", firstTier: "claimed", schema: z.string().max(500) },
  { key: "offering_models", label: "Advice only, investment management, or both", use: "filter", firstTier: "claimed", vocab: "offering_models", schema: someOf("offering_models", 2) },
  { key: "meeting_formats", label: "Meeting formats", use: "filter", firstTier: "claimed", vocab: "meeting_formats", schema: someOf("meeting_formats", 2) },
  { key: "in_person_metros", label: "Metro areas for in-person meetings", use: "score", firstTier: "claimed", schema: z.array(z.string()) },
  { key: "asset_minimum", label: "Asset minimum", use: "filter", firstTier: "claimed", schema: dollars },
  { key: "income_minimum", label: "Income minimum", use: "filter", firstTier: "claimed", schema: dollars },
  { key: "top_niches", label: "Top 3 client types", use: "score", firstTier: "claimed", vocab: "niches", schema: someOf("niches", 3) },
  { key: "top_services", label: "Top 3 services", use: "score", firstTier: "claimed", vocab: "services", schema: someOf("services", 3) },
  { key: "credentials", label: "Credentials", use: "display", firstTier: "claimed", vocab: "credentials", schema: z.array(oneOf("credentials")) },
  { key: "excluded_states", label: "States not taking new clients", use: "filter", firstTier: "claimed", schema: z.array(usState) },

  // Paid tier: extracted from written or recorded answers.
  { key: "ideal_client", label: "Ideal client", use: "score", firstTier: "paid", schema: z.string().max(1000) },
  { key: "client_exclusions", label: "Clients they turn away", use: "score", firstTier: "paid", schema: z.string().max(1000) },
  { key: "typical_asset_range", label: "Typical client assets", use: "score", firstTier: "paid", vocab: "asset_ranges", schema: someOf("asset_ranges") },
  { key: "typical_income_range", label: "Typical client income", use: "score", firstTier: "paid", vocab: "income_ranges", schema: someOf("income_ranges") },
  { key: "life_event_specialties", label: "Life events they specialize in", use: "score", firstTier: "paid", vocab: "life_events", schema: someOf("life_events") },
  { key: "deliverables", label: "What clients get", use: "display", firstTier: "paid", schema: z.array(z.string().max(200)) },
  { key: "meeting_cadence", label: "Meeting cadence", use: "score", firstTier: "paid", vocab: "cadence", schema: someOf("cadence") },
  { key: "onboarding_length_weeks", label: "Onboarding length (weeks)", use: "display", firstTier: "paid", schema: z.number().int().positive() },
  { key: "fee_drivers", label: "What makes the fee go up", use: "display", firstTier: "paid", schema: z.array(z.string().max(200)) },
  { key: "investment_philosophy", label: "Investment philosophy", use: "score", firstTier: "paid", vocab: "investment_philosophy", schema: someOf("investment_philosophy") },
  { key: "uses_tax_loss_harvesting", label: "Tax-loss harvesting", use: "display", firstTier: "paid", schema: z.boolean() },
  { key: "uses_direct_indexing", label: "Direct indexing", use: "display", firstTier: "paid", schema: z.boolean() },
  { key: "tax_depth", label: "Tax planning depth (1–4)", use: "score", firstTier: "paid", schema: z.number().int().min(1).max(4) },
  { key: "prepares_returns", label: "Prepares tax returns", use: "score", firstTier: "paid", schema: z.boolean() },
  { key: "specialty_situations", label: "Situations handled unusually well", use: "score", firstTier: "paid", schema: z.array(z.string().max(300)).max(2) },
  { key: "access_channels", label: "How clients reach them", use: "display", firstTier: "paid", vocab: "access_channels", schema: someOf("access_channels") },
  { key: "response_time_hours", label: "Typical response time (hours)", use: "display", firstTier: "paid", schema: z.number().positive() },
  { key: "involvement_style", label: "Collaboration style", use: "score", firstTier: "paid", vocab: "involvement", schema: someOf("involvement") },
  { key: "values_signals", label: "Values and identity signals", use: "score", firstTier: "paid", vocab: "values_prefs", schema: z.array(oneOf("values_prefs")) },
  { key: "languages", label: "Languages spoken", use: "score", firstTier: "paid", schema: z.array(z.string()) },
  { key: "personality_tags", label: "Personality and communication style", use: "display", firstTier: "paid", schema: z.array(z.string().max(40)).max(6) },
  { key: "continuity_plan", label: "Continuity plan", use: "display", firstTier: "paid", schema: z.string().max(1000) },
];

export const FIELD_BY_KEY: ReadonlyMap<string, FieldDef> = new Map(FIELDS.map((f) => [f.key, f]));

export function validateFactValue(fieldKey: string, value: unknown) {
  const def = FIELD_BY_KEY.get(fieldKey);
  if (!def) return { success: false as const, error: `Unknown field ${fieldKey}` };
  const r = def.schema.safeParse(value);
  return r.success ? { success: true as const, value: r.data } : { success: false as const, error: r.error.message };
}
