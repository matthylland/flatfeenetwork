/**
 * Inputs to the matcher. Everything here is plain data so the matcher is a
 * pure function: easy to test, and the same inputs always give the same 3.
 */

export type LatLng = { lat: number; lng: number };

/** Confirmed facts only, keyed by field key from src/taxonomy/fields.ts. */
export type AdvisorFacts = {
  annual_fee_range?: { min: number; max: number };
  offering_models?: string[];
  meeting_formats?: string[];
  asset_minimum?: number;
  income_minimum?: number;
  excluded_states?: string[];
  top_services?: string[];
  top_niches?: string[];
  life_event_specialties?: string[];
  typical_asset_range?: string[];
  involvement_style?: string[];
  meeting_cadence?: string[];
  values_signals?: string[];
  tax_depth?: number;
  prepares_returns?: boolean;
};

export type AdvisorCandidate = {
  profileId: string;
  /** Used ONLY to decide fallback eligibility, never in scoring. */
  claimed: boolean;
  facts: AdvisorFacts;
  officeLocation?: LatLng;
  clientCount?: number;
  /** 0..1 similarity between the prospect's own words and this advisor's answers, if computed. */
  semanticSimilarity?: number;
};

export type ProspectAnswers = {
  lifeEvents: string[];
  state?: string;
  location?: LatLng;
  meeting: "virtual_only" | "in_person_preferred" | "either";
  services: string[];
  /** Asked only when services include investment management. */
  offering?: "investment_management" | "advice_only" | "not_sure";
  assets?: string;
  income?: string;
  budget: string;
  involvement?: string;
  cadence?: string;
  values: string[];
  mustHaveValues: string[];
};

/** Adjustments layered on top of answers by "not for me" feedback. */
export type Constraints = {
  inPersonRequired?: boolean;
  virtualRequired?: boolean;
  /** Overrides the budget ceiling (no stretch applied). */
  feeCeiling?: number;
  feeFloor?: number;
  preferFirmSize?: { direction: "larger" | "smaller"; than: number };
  excludedProfileIds: string[];
};

export type FilterResult = { pass: true } | { pass: false; reason: FilterReason };

export type FilterReason =
  | "state_excluded"
  | "over_budget"
  | "under_fee_floor"
  | "asset_minimum"
  | "income_minimum"
  | "offering_model"
  | "no_in_person"
  | "too_far"
  | "no_virtual"
  | "missing_must_have"
  | "excluded";

export type FacetScore = { facet: string; weight: number; value: number | null; points: number };

export type ScoredCandidate = {
  candidate: AdvisorCandidate;
  score: number;
  breakdown: FacetScore[];
};

export type MatchResult = {
  profileId: string;
  rank: number;
  score: number;
  breakdown: FacetScore[];
  isUnclaimedFallback: boolean;
  reasons: string[];
};
