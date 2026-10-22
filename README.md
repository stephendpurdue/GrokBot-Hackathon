# Southbank

Southbank helps a community lead know members by what they are building, not by a phone number. Someone writes a sentence about their work. People who opted in and share those words appear as cards. A swipe right saves a connection in the browser.

Behind the page, weekly introductions are chosen in code from opt-in answers, each with a reason and a draft message. A speaker shortlist for a topic cites member answers or a public profile. Skips and source failures are written to an attempt log. People who did not opt in are never introduced.

Built for the Grok Bot Community Engineering London hackathon (Track 2). The full build plan is in `PLAN.md`.

## Stack

Next.js 15 (App Router), TypeScript, Tailwind, Supabase (Postgres), Zod, and an OpenAI-compatible client. MIT licence.

## Run locally

1. Copy `.env.example` to `.env` and fill in the Supabase URL, anon key, and service role key. The LLM key is optional: drafts fall back to a template if the call fails. `GITHUB_TOKEN` is optional.
2. Apply `supabase/migrations/0001_init.sql` to the project.
3. Install and seed:

```bash
npm install
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The deck is at `/demo`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app |
| `npm run seed` | Load the synthetic members in `data/seed.json` |
| `npm run verify-intros` | Check the two demo intro weeks |
| `npm run reset-demo` | Clear intros, speakers, attempts, and revives. Members stay |
| `npm run test-pipeline` | Run both intro weeks and the speaker topic |
| `npm run typecheck` | Typecheck |
| `npm run lint` | Lint |

## Pages

| Path | What it is |
|---|---|
| `/` | Welcome |
| `/demo` | Deck of members who share your words |
| `/connections/[handle]` | A saved connection |
| `/account` | Account |
| `/settings` | Settings |

Member data stays on the server. The browser talks to the API routes under `src/app/api`.

## Licence

MIT. See `LICENSE`.
