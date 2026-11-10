# Working in this repo

- Read `docs/ARCHITECTURE.md` first. Its rules (neutral ranking, no state filter, advisor-confirmed facts, private feedback) are product decisions by the owner. Don't change them without asking.
- After editing `src/db/schema.ts`, run `npm run db:generate` and commit the new migration in `drizzle/`. Never edit an applied migration.
- New vocabulary values go in `src/taxonomy/vocab.ts` with a `TAXONOMY_VERSION` bump. New profile fields go in `src/taxonomy/fields.ts`.
- Before pushing: `npm run typecheck && npm run lint && npm test` (set `TEST_DATABASE_URL` to a Postgres with pgvector to include database tests).
- Hosting is Railway; video is Mux. Don't add other hosting services without asking.
