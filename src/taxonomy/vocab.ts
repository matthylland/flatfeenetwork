/**
 * Controlled vocabularies. Every structured value the matcher reads comes from
 * one of these lists. AI extraction may only pick from them; it never invents
 * a new tag.
 *
 * Changing a list: bump TAXONOMY_VERSION. Stored facts record the version they
 * were extracted under, so a re-extraction job can find stale ones and re-run
 * from the stored answer text (never from the video).
 */

export const TAXONOMY_VERSION = 1;

export type Option = { key: string; label: string };

const opts = <const T extends readonly Option[]>(o: T) => o;

/** Prospect Q1: what's prompting the search. */
export const LIFE_EVENTS = opts([
  { key: "retiring_soon", label: "Retiring soon" },
  { key: "windfall_inheritance", label: "Windfall or inheritance" },
  { key: "new_job_equity", label: "New job or equity compensation" },
  { key: "marriage", label: "Marriage" },
  { key: "divorce", label: "Divorce" },
  { key: "death_of_spouse", label: "Death of a spouse" },
  { key: "business_sale", label: "Business sale" },
  { key: "want_a_plan", label: "I just want a plan" },
  { key: "other", label: "Other" },
] as const);

/** Prospect Q4 and advisor "services offered / strongest in". */
export const SERVICES = opts([
  { key: "investment_management", label: "Investment management" },
  { key: "retirement_income", label: "Retirement income" },
  { key: "tax_planning", label: "Tax planning" },
  { key: "estate_planning", label: "Estate planning" },
  { key: "insurance", label: "Insurance" },
  { key: "equity_comp", label: "Equity compensation" },
  { key: "college_planning", label: "College planning" },
  { key: "business_owner", label: "Business owner planning" },
  { key: "cash_flow_budgeting", label: "Cash flow and budgeting" },
] as const);

/**
 * What the advisor offers. Multi-select on the advisor side: a firm can offer
 * advice only, investment management, or both.
 */
export const OFFERING_MODELS = opts([
  { key: "advice_only", label: "Advice only" },
  { key: "investment_management", label: "Investment management" },
] as const);

/** Prospect Q4a. "not_sure" matches every offering model. */
export const PROSPECT_OFFERING_WANTS = opts([
  { key: "investment_management", label: "Manage my accounts" },
  { key: "advice_only", label: "Advise only" },
  { key: "not_sure", label: "Not sure" },
] as const);

export const MEETING_FORMATS = opts([
  { key: "virtual", label: "Virtual" },
  { key: "in_person", label: "In person" },
] as const);

/** Prospect Q3. */
export const PROSPECT_MEETING_WANTS = opts([
  { key: "virtual_only", label: "Virtual only" },
  { key: "in_person_preferred", label: "In person preferred" },
  { key: "either", label: "Either" },
] as const);

/** Prospect Q8 and advisor collaboration style. */
export const INVOLVEMENT = opts([
  { key: "hand_off", label: "Hand it off" },
  { key: "collaborate", label: "Collaborate" },
  { key: "learn_diy", label: "I want to learn and do some myself" },
] as const);

/** Prospect Q9 and advisor meeting cadence. */
export const CADENCE = opts([
  { key: "annual_semiannual", label: "Once or twice a year" },
  { key: "quarterly", label: "Quarterly" },
  { key: "on_demand", label: "Whenever I need it" },
] as const);

/** Prospect Q10. Score only, unless the prospect marks one "must have". */
export const VALUES_PREFS = opts([
  { key: "shares_faith", label: "Shares my faith" },
  { key: "lgbtq_affirming", label: "LGBTQ+ affirming" },
  { key: "speaks_language", label: "Speaks my language" },
  { key: "similar_life_stage", label: "Similar life stage" },
  { key: "woman_advisor", label: "Woman advisor" },
  { key: "values_based_investing", label: "Values-based investing" },
] as const);

/** Prospect Q5 (invested assets). Bounds in US dollars; max null = open. */
export const ASSET_RANGES = [
  { key: "lt_250k", label: "Under $250K", min: 0, max: 250_000 },
  { key: "250k_1m", label: "$250K–$1M", min: 250_000, max: 1_000_000 },
  { key: "1m_3m", label: "$1M–$3M", min: 1_000_000, max: 3_000_000 },
  { key: "3m_10m", label: "$3M–$10M", min: 3_000_000, max: 10_000_000 },
  { key: "gt_10m", label: "Over $10M", min: 10_000_000, max: null },
] as const;

/** Prospect Q6 (household income). */
export const INCOME_RANGES = [
  { key: "lt_100k", label: "Under $100K", min: 0, max: 100_000 },
  { key: "100k_200k", label: "$100K–$200K", min: 100_000, max: 200_000 },
  { key: "200k_400k", label: "$200K–$400K", min: 200_000, max: 400_000 },
  { key: "400k_1m", label: "$400K–$1M", min: 400_000, max: 1_000_000 },
  { key: "gt_1m", label: "Over $1M", min: 1_000_000, max: null },
] as const;

/** Prospect Q7 (annual fee budget). "not_sure" turns the budget filter off. */
export const FEE_BUDGETS = [
  { key: "lt_3k", label: "Under $3K", min: 0, max: 3_000 },
  { key: "3k_6k", label: "$3K–$6K", min: 3_000, max: 6_000 },
  { key: "6k_10k", label: "$6K–$10K", min: 6_000, max: 10_000 },
  { key: "10k_15k", label: "$10K–$15K", min: 10_000, max: 15_000 },
  { key: "gt_15k", label: "Over $15K", min: 15_000, max: null },
  { key: "not_sure", label: "Not sure, show me", min: null, max: null },
] as const;

/** Budget filter allows this much over the prospect's ceiling. */
export const FEE_STRETCH = 0.2;

/**
 * Fee structures. "Flat fee" means any fee that is not a percentage of assets
 * managed, so every structure here except pct_aum qualifies.
 */
export const FEE_STRUCTURES = opts([
  { key: "fixed_annual", label: "Fixed annual fee" },
  { key: "subscription", label: "Monthly or quarterly subscription" },
  { key: "hourly", label: "Hourly" },
  { key: "project", label: "Per project or one-time plan" },
  { key: "dollar_tiers", label: "Dollar-based tiers" },
  { key: "pct_aum", label: "Percentage of assets (not flat fee)" },
] as const);

export const TAX_DEPTH = [
  { value: 1, label: "Tax-aware investing only" },
  { value: 2, label: "Annual tax projections and strategy" },
  { value: 3, label: "Proactive multi-year tax planning" },
  { value: 4, label: "Full tax planning, including return review or prep" },
] as const;

export const INVESTMENT_PHILOSOPHY = opts([
  { key: "index", label: "Index" },
  { key: "factor", label: "Factor or evidence-based" },
  { key: "active", label: "Active" },
  { key: "values_based", label: "Values-based" },
] as const);

export const ACCESS_CHANNELS = opts([
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "text", label: "Text" },
  { key: "video", label: "Video calls" },
  { key: "client_portal", label: "Client portal" },
] as const);

export const CREDENTIALS = opts([
  { key: "cfp", label: "CFP" },
  { key: "cpa", label: "CPA" },
  { key: "ea", label: "EA" },
  { key: "cfa", label: "CFA" },
  { key: "chfc", label: "ChFC" },
  { key: "pfs", label: "PFS" },
  { key: "ricp", label: "RICP" },
  { key: "cdfa", label: "CDFA" },
  { key: "clu", label: "CLU" },
  { key: "cslp", label: "CSLP" },
] as const);

/** "Not for me" reasons on a match card. */
export const PASS_REASONS = opts([
  { key: "fee_too_high", label: "Fee too high" },
  { key: "fee_too_low", label: "Fee too low, or seems too basic" },
  { key: "want_in_person", label: "Want in person" },
  { key: "want_virtual", label: "Want virtual" },
  { key: "wrong_specialty", label: "Wrong specialty" },
  { key: "not_my_style", label: "Not my style" },
  { key: "firm_too_small", label: "Firm too small" },
  { key: "firm_too_large", label: "Firm too large" },
  { key: "other", label: "Other" },
] as const);

/** The ~40 client niches advisors pick their top 3 from. */
export const NICHES = opts([
  { key: "pre_retirees", label: "Pre-retirees (within 10 years)" },
  { key: "retirees", label: "Retirees" },
  { key: "early_retirement", label: "Early retirement / FIRE" },
  { key: "young_professionals", label: "Young professionals" },
  { key: "recent_grads", label: "Recent graduates with student loans" },
  { key: "henrys", label: "High earners, not rich yet" },
  { key: "mid_career_families", label: "Mid-career families" },
  { key: "newlyweds", label: "Newlyweds and couples merging finances" },
  { key: "single_parents", label: "Single parents" },
  { key: "divorcing", label: "Divorcing or recently divorced" },
  { key: "widowed", label: "Widowed" },
  { key: "women_investors", label: "Women investors" },
  { key: "lgbtq_couples", label: "LGBTQ+ individuals and couples" },
  { key: "special_needs_families", label: "Families with special-needs dependents" },
  { key: "aging_parent_caregivers", label: "Caregivers for aging parents" },
  { key: "inheritors", label: "Inheritors" },
  { key: "first_gen_wealth", label: "First-generation wealth" },
  { key: "physicians", label: "Physicians" },
  { key: "dentists", label: "Dentists" },
  { key: "nurses", label: "Nurses and allied health" },
  { key: "attorneys", label: "Attorneys" },
  { key: "engineers", label: "Engineers" },
  { key: "tech_equity", label: "Tech employees with equity" },
  { key: "executives", label: "Corporate executives" },
  { key: "small_business_owners", label: "Small business owners" },
  { key: "business_sellers", label: "Business owners planning a sale" },
  { key: "self_employed", label: "Self-employed and freelancers" },
  { key: "real_estate_investors", label: "Real estate investors" },
  { key: "teachers", label: "Teachers and school staff" },
  { key: "public_employees", label: "State and local government employees" },
  { key: "federal_employees", label: "Federal employees" },
  { key: "military_veterans", label: "Military and veterans" },
  { key: "pilots", label: "Pilots" },
  { key: "academics", label: "Professors and academics" },
  { key: "nonprofit_workers", label: "Nonprofit employees" },
  { key: "clergy", label: "Clergy" },
  { key: "creatives", label: "Artists and creatives" },
  { key: "athletes_entertainers", label: "Athletes and entertainers" },
  { key: "farmers_ranchers", label: "Farmers and ranchers" },
  { key: "expats", label: "Americans abroad" },
  { key: "immigrants", label: "Immigrants and visa holders" },
] as const);

export const VOCABULARIES = {
  life_events: LIFE_EVENTS,
  services: SERVICES,
  offering_models: OFFERING_MODELS,
  prospect_offering_wants: PROSPECT_OFFERING_WANTS,
  meeting_formats: MEETING_FORMATS,
  prospect_meeting_wants: PROSPECT_MEETING_WANTS,
  involvement: INVOLVEMENT,
  cadence: CADENCE,
  values_prefs: VALUES_PREFS,
  asset_ranges: ASSET_RANGES,
  income_ranges: INCOME_RANGES,
  fee_budgets: FEE_BUDGETS,
  fee_structures: FEE_STRUCTURES,
  investment_philosophy: INVESTMENT_PHILOSOPHY,
  access_channels: ACCESS_CHANNELS,
  credentials: CREDENTIALS,
  pass_reasons: PASS_REASONS,
  niches: NICHES,
} as const;

export type VocabularyName = keyof typeof VOCABULARIES;

export function vocabKeys(name: VocabularyName): string[] {
  return VOCABULARIES[name].map((o) => o.key);
}
