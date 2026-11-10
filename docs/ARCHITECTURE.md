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

`src/adv/parse.ts` streams the SEC firm compilation feed, one `<Firm>` at a time. `mapFirm` is the only function that knows the feed's element names. `src/adv/import.ts` upserts firms by CRD and creates one unclaimed listing for each flat-fee candidate: a firm filing fixed, hourly or subscription fees (Form ADV Item 5.E). Firms that also charge a percentage of assets are listed; claiming confirms which fee is primary. Existing listings are never overwritten by the import.
