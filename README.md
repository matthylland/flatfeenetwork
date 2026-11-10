# Flat Fee Network

A directory that matches people with flat-fee financial advisors. A prospect answers about 10 questions and gets 3 matched advisors, each with a plain reason why. Their feedback refines the next set.

Build plan: https://claude.ai/artifact/AaAU9AvHtnM7CVmPHKtxEb
Questionnaire and profile fields: https://claude.ai/artifact/15DGdrNCakHVh5hpT6YNwK

## Stack

- Next.js (App Router, TypeScript, Tailwind), hosted on Railway
- Postgres with pgvector (Railway's pgvector template), via Drizzle ORM
- Mux for video, a speech-to-text API with word timestamps, and Claude for extraction (later phases)

## Local setup

```bash
npm install
cp .env.example .env          # point DATABASE_URL at a Postgres with pgvector
npm run db:migrate
npm run dev
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app locally |
| `npm test` | Unit tests. Set `TEST_DATABASE_URL` to also run the database tests (they empty every table, so use a throwaway database) |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run import:adv -- <file-or-url> ...` | Import Form ADV firm feeds (`.xml` or `.xml.gz`) |
| `npm run seed:demo` | Add 6 fictional claimed advisors to try the questionnaire (local or preview databases only) |

## Deploying on Railway

1. Create a project with a **Postgres (pgvector)** service and a service for this repo.
2. Set `DATABASE_URL` on the app service to the Postgres connection string.
3. Set the pre-deploy command to `npm run db:migrate`. Build and start use `npm run build` and `npm start`.
4. Add a cron service from this repo that runs `npm run import:adv -- <SEC feed URL> <state feed URL>` monthly. The feeds are the IA firm compilation reports (SEC-registered and state-registered) published by the SEC on adviserinfo.sec.gov.

See `docs/ARCHITECTURE.md` for how the data fits together.
