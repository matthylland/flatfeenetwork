/**
 * Database schema. See docs/ARCHITECTURE.md for how the layers fit together:
 *
 *   take (raw media) -> transcript -> answer (approved text) -> extracted facts
 *                                                           -> answer chunks (embeddings)
 *
 * Written and recorded answers are identical from `answers` down, so matching
 * never knows (or cares) how an advisor answered.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/** Embedding size for answer and prospect chunks (Voyage default is 1024). */
export const EMBEDDING_DIMENSIONS = 1024;

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------------------------------------------------------------------------
// Firms and listings
// ---------------------------------------------------------------------------

export const registrationTypeEnum = pgEnum("registration_type", ["sec", "state", "unknown"]);

/** One row per adviser firm from Form ADV, refreshed by the monthly import. */
export const firms = pgTable(
  "firms",
  {
    id: id(),
    crd: integer("crd").notNull(),
    secNumber: text("sec_number"),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    website: text("website"),
    phone: text("phone"),
    street1: text("street1"),
    street2: text("street2"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    country: text("country"),
    registrationType: registrationTypeEnum("registration_type").notNull().default("unknown"),
    /** Shown on the profile only. Never a match filter (de minimis rule). */
    registeredStates: text("registered_states").array().notNull().default(sql`'{}'::text[]`),
    noticeFiledStates: text("notice_filed_states").array().notNull().default(sql`'{}'::text[]`),
    /** Form ADV Item 5.E compensation flags, as filed. */
    feeFlags: jsonb("fee_flags").$type<AdvFeeFlags>().notNull(),
    /** Any non-AUM fee type filed: fixed, hourly or subscription. */
    flatFeeCandidate: boolean("flat_fee_candidate").notNull(),
    assetsUnderManagement: bigint("assets_under_management", { mode: "number" }),
    clientCount: integer("client_count"),
    employeeCount: integer("employee_count"),
    hasDisclosures: boolean("has_disclosures"),
    advFilingDate: date("adv_filing_date"),
    lastImportRunId: uuid("last_import_run_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("firms_crd_idx").on(t.crd), index("firms_state_idx").on(t.state)],
);

export type AdvFeeFlags = {
  pctAum: boolean;
  hourly: boolean;
  subscription: boolean;
  fixed: boolean;
  commissions: boolean;
  performance: boolean;
  other: boolean;
  otherDescription?: string;
};

export const tierEnum = pgEnum("tier", ["unclaimed", "claimed", "paid"]);

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
);

/**
 * A listing: the unit that gets matched. Unclaimed listings are firm-level and
 * auto-built from ADV. Claiming attaches an owner. Tier is never an input to
 * scoring.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: id(),
    firmId: uuid("firm_id").notNull().references(() => firms.id),
    ownerUserId: uuid("owner_user_id").references(() => users.id),
    tier: tierEnum("tier").notNull().default("unclaimed"),
    displayName: text("display_name").notNull(),
    individualCrd: integer("individual_crd"),
    slug: text("slug").notNull(),
    headshotUrl: text("headshot_url"),
    intro: text("intro"),
    bookingUrl: text("booking_url"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    paidThrough: timestamp("paid_through", { withTimezone: true }),
    isLive: boolean("is_live").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("profiles_slug_idx").on(t.slug), index("profiles_firm_idx").on(t.firmId), index("profiles_tier_idx").on(t.tier)],
);

// ---------------------------------------------------------------------------
// Answer pipeline: take -> transcript -> answer -> facts / chunks
// ---------------------------------------------------------------------------

export const mediaKindEnum = pgEnum("media_kind", ["video", "audio"]);
export const takeStatusEnum = pgEnum("take_status", ["uploading", "processing", "ready", "chosen", "discarded", "failed"]);

/** Layer 1: one raw recording of one question. Unchosen takes are deleted at submit. */
export const takes = pgTable(
  "takes",
  {
    id: id(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id),
    questionKey: text("question_key").notNull(),
    questionVersion: integer("question_version").notNull(),
    mediaKind: mediaKindEnum("media_kind").notNull(),
    /** e.g. "mux". */
    storageProvider: text("storage_provider").notNull(),
    /** Provider's asset id; never a public URL. */
    storageRef: text("storage_ref"),
    durationMs: integer("duration_ms"),
    status: takeStatusEnum("status").notNull().default("uploading"),
    recordingConsentAt: timestamp("recording_consent_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("takes_profile_question_idx").on(t.profileId, t.questionKey)],
);

export type TranscriptWord = { w: string; startMs: number; endMs: number; confidence: number };

/** Layer 2: the machine transcript, with a timestamp on every word. */
export const transcripts = pgTable("transcripts", {
  id: id(),
  takeId: uuid("take_id").notNull().references(() => takes.id),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  text: text("text").notNull(),
  words: jsonb("words").$type<TranscriptWord[]>().notNull(),
  language: text("language"),
  createdAt: createdAt(),
});

export const answerSourceEnum = pgEnum("answer_source", ["written", "recorded"]);
export const answerStatusEnum = pgEnum("answer_status", ["draft", "approved", "superseded"]);

/**
 * Layer 3: the advisor-approved text for one question. The single source of
 * truth for matching. Editing creates a new version.
 */
export const answers = pgTable(
  "answers",
  {
    id: id(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id),
    questionKey: text("question_key").notNull(),
    questionVersion: integer("question_version").notNull(),
    source: answerSourceEnum("source").notNull(),
    takeId: uuid("take_id").references(() => takes.id),
    transcriptId: uuid("transcript_id").references(() => transcripts.id),
    text: text("text").notNull(),
    version: integer("version").notNull().default(1),
    status: answerStatusEnum("status").notNull().default("draft"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("answers_profile_question_version_idx").on(t.profileId, t.questionKey, t.version)],
);

export const factStatusEnum = pgEnum("fact_status", ["proposed", "confirmed", "rejected"]);
export const factSourceEnum = pgEnum("fact_source", ["adv", "advisor_form", "extraction"]);

/**
 * Layer 4: one typed value for one field (see src/taxonomy/fields.ts).
 * Only `confirmed` facts reach matching. Each fact can point back to the exact
 * words (character range in the answer) and video seconds it came from; those
 * pointers produce "why we matched" lines and clip suggestions.
 */
export const extractedFacts = pgTable(
  "extracted_facts",
  {
    id: id(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id),
    fieldKey: text("field_key").notNull(),
    value: jsonb("value").notNull(),
    taxonomyVersion: integer("taxonomy_version").notNull(),
    source: factSourceEnum("source").notNull(),
    status: factStatusEnum("status").notNull().default("proposed"),
    confidence: real("confidence"),
    answerId: uuid("answer_id").references(() => answers.id),
    evidenceCharStart: integer("evidence_char_start"),
    evidenceCharEnd: integer("evidence_char_end"),
    evidenceMsStart: integer("evidence_ms_start"),
    evidenceMsEnd: integer("evidence_ms_end"),
    extractorModel: text("extractor_model"),
    confirmedByUserId: uuid("confirmed_by_user_id").references(() => users.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("facts_profile_field_idx").on(t.profileId, t.fieldKey, t.status)],
);

/** Layer 5: passages of an approved answer, embedded for semantic matching. */
export const answerChunks = pgTable(
  "answer_chunks",
  {
    id: id(),
    answerId: uuid("answer_id").notNull().references(() => answers.id),
    profileId: uuid("profile_id").notNull().references(() => profiles.id),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    charStart: integer("char_start").notNull(),
    charEnd: integer("char_end").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    embeddingModel: text("embedding_model").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("answer_chunks_profile_idx").on(t.profileId),
    index("answer_chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const clipStatusEnum = pgEnum("clip_status", ["suggested", "approved", "rejected"]);

/** Short public clips cut from a chosen take. Captions use the words actually spoken. */
export const clips = pgTable("clips", {
  id: id(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id),
  takeId: uuid("take_id").notNull().references(() => takes.id),
  startMs: integer("start_ms").notNull(),
  endMs: integer("end_ms").notNull(),
  title: text("title"),
  status: clipStatusEnum("status").notNull().default("suggested"),
  providerRef: text("provider_ref"),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Prospects, matches and feedback
// ---------------------------------------------------------------------------

/** Anonymous until the prospect chooses to contact an advisor. */
export const prospectSessions = pgTable("prospect_sessions", {
  id: id(),
  zip: text("zip"),
  createdAt: createdAt(),
});

export const prospectAnswers = pgTable(
  "prospect_answers",
  {
    sessionId: uuid("session_id").notNull().references(() => prospectSessions.id),
    questionKey: text("question_key").notNull(),
    questionVersion: integer("question_version").notNull(),
    value: jsonb("value").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.questionKey] })],
);

export const prospectChunks = pgTable("prospect_chunks", {
  id: id(),
  sessionId: uuid("session_id").notNull().references(() => prospectSessions.id),
  chunkIndex: integer("chunk_index").notNull(),
  text: text("text").notNull(),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
  embeddingModel: text("embedding_model").notNull(),
});

/** One round of 3 matches. Each feedback round makes a new set. */
export const matchSets = pgTable("match_sets", {
  id: id(),
  sessionId: uuid("session_id").notNull().references(() => prospectSessions.id),
  round: integer("round").notNull(),
  /** The prospect's effective constraints after feedback adjustments. */
  constraints: jsonb("constraints").notNull(),
  scorerVersion: text("scorer_version").notNull(),
  createdAt: createdAt(),
});

export const matches = pgTable(
  "matches",
  {
    id: id(),
    matchSetId: uuid("match_set_id").notNull().references(() => matchSets.id),
    profileId: uuid("profile_id").notNull().references(() => profiles.id),
    rank: integer("rank").notNull(),
    score: real("score").notNull(),
    /** Every facet's contribution, stored so any result can be explained or audited. */
    scoreBreakdown: jsonb("score_breakdown").notNull(),
    explanation: jsonb("explanation"),
    /** True when an unclaimed listing filled a slot because fewer than 3 claimed advisors passed. */
    isUnclaimedFallback: boolean("is_unclaimed_fallback").notNull().default(false),
  },
  (t) => [index("matches_profile_idx").on(t.profileId)],
);

export const feedbackKindEnum = pgEnum("feedback_kind", ["interested", "not_for_me", "show_more"]);

/** Private to the advisor; never published. */
export const feedbackEvents = pgTable("feedback_events", {
  id: id(),
  matchId: uuid("match_id").notNull().references(() => matches.id),
  kind: feedbackKindEnum("kind").notNull(),
  reason: text("reason"),
  freeText: text("free_text"),
  createdAt: createdAt(),
});

/** Sent through the directory so every contact is counted. Email is collected only here. */
export const contactRequests = pgTable("contact_requests", {
  id: id(),
  sessionId: uuid("session_id").references(() => prospectSessions.id),
  profileId: uuid("profile_id").notNull().references(() => profiles.id),
  matchId: uuid("match_id").references(() => matches.id),
  prospectEmail: text("prospect_email").notNull(),
  message: text("message").notNull(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const profileEventKindEnum = pgEnum("profile_event_kind", ["matched", "profile_view", "contact", "booking_click", "missed_match"]);

/** Raw events behind the advisor analytics dashboard. */
export const profileEvents = pgTable(
  "profile_events",
  {
    id: id(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id),
    kind: profileEventKindEnum("kind").notNull(),
    sessionId: uuid("session_id").references(() => prospectSessions.id),
    detail: jsonb("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("profile_events_profile_kind_idx").on(t.profileId, t.kind, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export const advImportRuns = pgTable("adv_import_runs", {
  id: id(),
  source: text("source").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  firmsSeen: integer("firms_seen").notNull().default(0),
  firmsUpserted: integer("firms_upserted").notNull().default(0),
  listingsCreated: integer("listings_created").notNull().default(0),
  errors: jsonb("errors").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
});

// ---------------------------------------------------------------------------
// Advisor sign-in and claims
// ---------------------------------------------------------------------------

/** One-time email codes. Only a hash of the code is stored. */
export const emailCodes = pgTable(
  "email_codes",
  {
    id: id(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("email_codes_email_idx").on(sql`lower(${t.email})`, t.createdAt)],
);

/** Signed-in advisor sessions. The cookie holds the token; only its hash is stored. */
export const userSessions = pgTable("user_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const claimStatusEnum = pgEnum("claim_status", ["awaiting_code", "pending_review", "approved", "rejected"]);

/**
 * A request to claim a listing, or to be listed ("Get listed"). Approved
 * automatically when the verified email's domain matches the firm's website;
 * otherwise reviewed by hand at /admin/claims.
 */
export const claimRequests = pgTable(
  "claim_requests",
  {
    id: id(),
    crd: integer("crd").notNull(),
    profileId: uuid("profile_id").references(() => profiles.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    note: text("note"),
    status: claimStatusEnum("status").notNull().default("awaiting_code"),
    domainMatch: boolean("domain_match").notNull().default(false),
    userId: uuid("user_id").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("claim_requests_status_idx").on(t.status, t.createdAt)],
);
