# Architecture

## Answers become matchable data in five layers

| Layer | Table | Holds |
| --- | --- | --- |
| 1. Take | `takes` | One raw video or audio recording of one question (stored at Mux, referenced by id). Unchosen retakes are deleted at submit |
| 2. Transcript | `transcripts` | Machine transcript with a timestamp and confidence on every word |
| 3. Answer | `answers` | The advisor-approved text for one question, typed or edited from the transcript. Versioned. The source of truth |
| 4. Facts | `extracted_facts` | Typed values for fields in `src/taxonomy/fields.ts`, each with a confidence, a status, and an evidence pointer (character range in the answer, time range in the video) |
| 5. Chunks | `answer_chunks` | Passages of approved answers with embeddings, for semantic similarity to the prospect's own words |

Written and recorded answers are identical from layer 3 down, so matching never depends on how an advisor answered.

## Rules

- **Fixed, versioned vocabularies** (`src/taxonomy/vocab.ts`). Extraction picks from them and never invents tags. Changing a list bumps `TAXONOMY_VERSION`; re-extract from stored answer text, never from video.
- **Every fact is confirmed one by one** by the advisor before matching reads it. Only `status = confirmed` facts count.
- **Questions are versioned** (`src/questions`). Answers store the question key and version.
- **Tier never affects scoring.** Paid profiles match better only because they hold more confirmed facts. Missing data earns no credit and is never a penalty.
- **The advisor's state is never a filter.** Advisors can serve any state under the de minimis rule. Location only matters, as distance, when a prospect wants in person. Advisors may list states they're not taking new clients in (`excluded_states`).
- **Advice only / investment management / both.** Advisors can offer both; a firm offering both passes either prospect request. "Not sure" passes everyone.
- **Unclaimed listings are a fallback.** Claimed profiles fill the 3 match slots first. Unclaimed listings, marked unverified, fill a slot only when fewer than 3 claimed advisors pass the filters (`matches.is_unclaimed_fallback`).
- **Ranking is a formula, not an LLM.** AI extracts facts and writes explanations; scoring is deterministic, stored per match (`score_breakdown`), and testable.
- **Prospect feedback is private** to the advisor and never published. Prospect email is collected only when they contact an advisor, through `contact_requests`.

## Form ADV import

`src/adv/parse.ts` streams the SEC firm compilation feed, one `<Firm>` at a time. `mapFirm` is the only function that knows the feed's element names. `src/adv/import.ts` upserts firms by CRD and creates one unclaimed listing for each flat-fee candidate (`isFlatFeeCandidate`): a firm filing fixed, hourly or subscription fees (Form ADV Item 5.E) that either doesn't check the percentage-of-assets box or reports no assets under management. Firms with real AUM that charge on assets mostly charge on assets, so they are listed only after they claim a profile and it is approved. Existing listings are never overwritten by the import.

## Matching (`src/matching`)

`findMatches(candidates, prospect, constraints, options)` is a pure function:

1. **Hard filters** (`filters.ts`): excluded states the advisor chose, fee budget (+20% stretch, or the ceiling feedback set), asset and income minimums, advice only / investment management, meeting format when required (in person within 60 miles), and the prospect's "must have" values. Missing advisor data never fails a filter, except a must-have.
2. **Fit score** (`score.ts`): a weighted sum of facets. Each facet scores 0–1, or earns nothing when the advisor has no data. The advisor's tier is not an input. Every match stores its full breakdown and the `SCORER_VERSION` that made it.
3. **Pick 3** (`match.ts`): claimed profiles first, ranked by score; near-ties rotate by session; over-exposed advisors move to the back; slots 2 and 3 prefer a different price point or meeting style among candidates within 85% of the top score. Unclaimed listings fill only the slots claimed profiles can't.
4. **Feedback** (`feedback.ts`): each "not for me" reason adjusts the constraints for the next round, and the advisor is excluded from later rounds.

Tests in `test/matching.test.ts` pin the product rules, including identical scores for a paid and a free profile with identical facts.

## Prospect flow (`src/prospect`, `src/app/match`)

`/match` is the questionnaire. Submitting it creates an anonymous `prospect_sessions` row, stores each answer with its question version, runs round 1 and redirects to `/match/<session>`. On the results page the prospect reacts to each card (Interested, or Not for me with a reason). "Show me 3 more" builds the next round: every "not for me" reason from the current round adjusts the constraints, and everyone already shown is excluded. Each round's constraints and scorer version are stored on `match_sets`; each match logs a `matched` event and each filtered-out claimed advisor a `missed_match` event for advisor analytics.

## Browse and profiles (`src/directory`, `src/app/advisors`)

`/advisors` searches live listings of flat-fee firms by name, city or CRD, sorted by name. Tier never changes the order. `/advisors/<slug>` shows the advisor's confirmed facts (`src/directory/format.ts` decides which fields are public; location and excluded states never are) and the firm's Form ADV data, and logs a `profile_view` event. A view or contact is credited to a match only when the match really belongs to that profile and session; any other `m`/`s` link parameters are ignored.

Only claimed profiles take messages. A message is stored in `contact_requests`, logged as a `contact` event, and emailed to the profile's owner with the prospect as reply-to (`delivered_at` is set once sent). Unclaimed listings show the firm's website and phone instead.

## Claims and advisor sign-in (`src/claims`, `src/auth`, `src/advisor`)

Advisors sign in with a 6-digit code sent by email; codes and session tokens are stored only as hashes. `/claim` takes a CRD, name, role and work email. After the code is confirmed, the claim is approved at once if the email's domain matches the firm's website and the listing is unclaimed. Everything else (webmail addresses, firms without a listing, firms not yet in the SEC data, listings someone already owns) waits for the site owner (`ADMIN_EMAIL`) at `/admin/claims`. Approving a firm with no listing creates one, so a firm that filed its flat fee as "other" can still be listed. Any claimed profile is shown and matched whatever its ADV fee flags.

Claimed advisors fill in the short form at `/advisor/<profileId>`: fee range, what the fee covers, advice only / investment management, meeting formats, top 3 services, asset minimum, intro and booking link. Each answer is saved as a confirmed `advisor_form` fact.

Email goes through Resend (`src/email`). Without `RESEND_API_KEY`, emails are logged instead of sent.
