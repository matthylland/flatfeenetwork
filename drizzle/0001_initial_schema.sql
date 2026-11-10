CREATE TYPE "public"."answer_source" AS ENUM('written', 'recorded');--> statement-breakpoint
CREATE TYPE "public"."answer_status" AS ENUM('draft', 'approved', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."clip_status" AS ENUM('suggested', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."fact_source" AS ENUM('adv', 'advisor_form', 'extraction');--> statement-breakpoint
CREATE TYPE "public"."fact_status" AS ENUM('proposed', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."feedback_kind" AS ENUM('interested', 'not_for_me', 'show_more');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('video', 'audio');--> statement-breakpoint
CREATE TYPE "public"."profile_event_kind" AS ENUM('matched', 'profile_view', 'contact', 'booking_click', 'missed_match');--> statement-breakpoint
CREATE TYPE "public"."registration_type" AS ENUM('sec', 'state', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."take_status" AS ENUM('uploading', 'processing', 'ready', 'chosen', 'discarded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('unclaimed', 'claimed', 'paid');--> statement-breakpoint
CREATE TABLE "adv_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"firms_seen" integer DEFAULT 0 NOT NULL,
	"firms_upserted" integer DEFAULT 0 NOT NULL,
	"listings_created" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answer_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"answer_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"text" text NOT NULL,
	"char_start" integer NOT NULL,
	"char_end" integer NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"embedding_model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"question_key" text NOT NULL,
	"question_version" integer NOT NULL,
	"source" "answer_source" NOT NULL,
	"take_id" uuid,
	"transcript_id" uuid,
	"text" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "answer_status" DEFAULT 'draft' NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"take_id" uuid NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"title" text,
	"status" "clip_status" DEFAULT 'suggested' NOT NULL,
	"provider_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"profile_id" uuid NOT NULL,
	"match_id" uuid,
	"prospect_email" text NOT NULL,
	"message" text NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"value" jsonb NOT NULL,
	"taxonomy_version" integer NOT NULL,
	"source" "fact_source" NOT NULL,
	"status" "fact_status" DEFAULT 'proposed' NOT NULL,
	"confidence" real,
	"answer_id" uuid,
	"evidence_char_start" integer,
	"evidence_char_end" integer,
	"evidence_ms_start" integer,
	"evidence_ms_end" integer,
	"extractor_model" text,
	"confirmed_by_user_id" uuid,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"kind" "feedback_kind" NOT NULL,
	"reason" text,
	"free_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crd" integer NOT NULL,
	"sec_number" text,
	"name" text NOT NULL,
	"legal_name" text,
	"website" text,
	"phone" text,
	"street1" text,
	"street2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text,
	"registration_type" "registration_type" DEFAULT 'unknown' NOT NULL,
	"registered_states" text[] DEFAULT '{}'::text[] NOT NULL,
	"notice_filed_states" text[] DEFAULT '{}'::text[] NOT NULL,
	"fee_flags" jsonb NOT NULL,
	"flat_fee_candidate" boolean NOT NULL,
	"assets_under_management" bigint,
	"client_count" integer,
	"employee_count" integer,
	"has_disclosures" boolean,
	"adv_filing_date" date,
	"last_import_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"constraints" jsonb NOT NULL,
	"scorer_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_set_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"score" real NOT NULL,
	"score_breakdown" jsonb NOT NULL,
	"explanation" jsonb,
	"is_unclaimed_fallback" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"kind" "profile_event_kind" NOT NULL,
	"session_id" uuid,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"tier" "tier" DEFAULT 'unclaimed' NOT NULL,
	"display_name" text NOT NULL,
	"individual_crd" integer,
	"slug" text NOT NULL,
	"headshot_url" text,
	"intro" text,
	"booking_url" text,
	"claimed_at" timestamp with time zone,
	"paid_through" timestamp with time zone,
	"is_live" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_answers" (
	"session_id" uuid NOT NULL,
	"question_key" text NOT NULL,
	"question_version" integer NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prospect_answers_session_id_question_key_pk" PRIMARY KEY("session_id","question_key")
);
--> statement-breakpoint
CREATE TABLE "prospect_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"text" text NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"embedding_model" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospect_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "takes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"question_key" text NOT NULL,
	"question_version" integer NOT NULL,
	"media_kind" "media_kind" NOT NULL,
	"storage_provider" text NOT NULL,
	"storage_ref" text,
	"duration_ms" integer,
	"status" "take_status" DEFAULT 'uploading' NOT NULL,
	"recording_consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"take_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"text" text NOT NULL,
	"words" jsonb NOT NULL,
	"language" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answer_chunks" ADD CONSTRAINT "answer_chunks_answer_id_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."answers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_chunks" ADD CONSTRAINT "answer_chunks_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_take_id_takes_id_fk" FOREIGN KEY ("take_id") REFERENCES "public"."takes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_take_id_takes_id_fk" FOREIGN KEY ("take_id") REFERENCES "public"."takes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_session_id_prospect_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."prospect_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_requests" ADD CONSTRAINT "contact_requests_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_facts" ADD CONSTRAINT "extracted_facts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_facts" ADD CONSTRAINT "extracted_facts_answer_id_answers_id_fk" FOREIGN KEY ("answer_id") REFERENCES "public"."answers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_facts" ADD CONSTRAINT "extracted_facts_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_events" ADD CONSTRAINT "feedback_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_sets" ADD CONSTRAINT "match_sets_session_id_prospect_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."prospect_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_match_set_id_match_sets_id_fk" FOREIGN KEY ("match_set_id") REFERENCES "public"."match_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_events" ADD CONSTRAINT "profile_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_events" ADD CONSTRAINT "profile_events_session_id_prospect_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."prospect_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_answers" ADD CONSTRAINT "prospect_answers_session_id_prospect_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."prospect_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_chunks" ADD CONSTRAINT "prospect_chunks_session_id_prospect_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."prospect_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takes" ADD CONSTRAINT "takes_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_take_id_takes_id_fk" FOREIGN KEY ("take_id") REFERENCES "public"."takes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "answer_chunks_profile_idx" ON "answer_chunks" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "answer_chunks_embedding_idx" ON "answer_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "answers_profile_question_version_idx" ON "answers" USING btree ("profile_id","question_key","version");--> statement-breakpoint
CREATE INDEX "facts_profile_field_idx" ON "extracted_facts" USING btree ("profile_id","field_key","status");--> statement-breakpoint
CREATE UNIQUE INDEX "firms_crd_idx" ON "firms" USING btree ("crd");--> statement-breakpoint
CREATE INDEX "firms_state_idx" ON "firms" USING btree ("state");--> statement-breakpoint
CREATE INDEX "matches_profile_idx" ON "matches" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "profile_events_profile_kind_idx" ON "profile_events" USING btree ("profile_id","kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_slug_idx" ON "profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "profiles_firm_idx" ON "profiles" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "profiles_tier_idx" ON "profiles" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "takes_profile_question_idx" ON "takes" USING btree ("profile_id","question_key");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree (lower("email"));