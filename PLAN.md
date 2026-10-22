# Know Your Members: Master Build File

Grok Bot Community Engineering London Hackathon, Thu 22 Oct 2026. Hacking now, feature freeze 21:15, code freeze 21:50, Top 5 demo 22:20.

**Track 2 · Members, intros & speakers.** A lead stops knowing members as phone numbers: opt-in answers become one introduction a week, with a reason, and a speaker shortlist that cites proof.

## How this single file is divided

One file, five parts. Each Cursor agent reads **PART 0 (shared) plus its own part, and nothing else**. Parts are fenced by `<!-- ===== ... ===== -->` markers so you can also copy a part out on its own.

| Part | Who reads it | Contains |
|---|---|---|
| PART 0 | Everyone | Goal, data flow, stack, file ownership, data model, frozen contract, API, rules |
| PART A | Agent A (data) | Migration SQL, seed spec, tasks |
| PART B | Agent B (pipeline) | Weekly intros, GitHub speaker source, API, tasks |
| PART C | Agent C (frontend) | Lead view, tasks |
| PART H | Human only | Setup, timeline, demo script, judging, risks |

**To start an agent:** this file is `PLAN.md` at the repo root. Paste that agent's prompt (the first block in its part). Each agent builds its MVP tasks and stops.

## MVP

The demo at M2 is one page, `/`. Nothing else is required to win the room.

1. **Members.** Twelve people from the seed. Kai Rahman and Leah Cohen show as "no intros".
2. **This week.** "Run this week" streams `load`, `match`, `draft`, `save`, then three cards: Ada Okonkwo–Ben Shah, Chioma Adeyemi–Dan Ellis, Elena Petrova–Farid Hassan. Each card shows the code reason, both answer quotes, and the template message. Copy works. A second click says "Already ran this week".
3. **A month later.** "Run a month later" adds two cards under the first week: Ada–Maya Rahman, Ben–Noah Grant. Week one does not change. Kai is still absent.
4. **Speakers.** Topic `community bots`. Chioma appears with her talk quote. GitHub search for that topic in London adds public names, each with a profile URL. If GitHub fails, a saved response is shown and labelled `fixture`. Chioma's fake handle is an error in the log, not a speaker row.
5. **Log.** Visible rows for `no consent`, `no complement`, `best partner already introduced`, and the GitHub failure.

Drafts are the template in 0.6. The model is not on the MVP path.

**Not in the MVP. Do not start these until the human says the page above works:** thread reviver, Devpost, Hacker News, Luma, LLM client, `POST /api/answers`, Notion, Discord, Cognee, the private export.

## Subagents

Human does T0 first (scaffold, frozen contract, env, three branches). Then three agents in parallel. Merge A, then B, then C.

| Agent | Branch | Reads | MVP tasks | Stops before |
|---|---|---|---|---|
| A, data | `agent-a-data` | PART 0, PART A | A1–A5 | Any file outside 0.4 |
| B, pipeline | `agent-b-pipeline` | PART 0, PART B | B2, B3, B4 GitHub only, B5, B7, B8 | LLM client, reviver, Devpost, HN, Luma, answer webhook |
| C, frontend | `agent-c-frontend` | PART 0, PART C | C1–C5 | Reviver panel |

## Track fit

| The brief asks for | What we ship |
|---|---|
| Short opt-in questionnaire over WhatsApp or Discord | Four questions, a copyable outbound message, and `POST /api/answers` for a channel webhook. No unofficial WhatsApp client. |
| Answers in a member graph (Cognee or Supabase) | Supabase. The graph is scored pairs in `intros`, not a second database. |
| One good intro a week per member, with why, still works a month later | `pickWeeklyPairs` plus `week_start`. Re-run with `asOf` 30 days ahead. State lives in the DB, so no organiser is in the loop. |
| Speaker finder for a topic, members and London builders, with proof | Code gathers GitHub, Devpost, Hacker News, and Luma. Every name has evidence. The model only writes the sentence. |
| Thread reviver plus a log of tries and failures | Dead-thread scan, drafted nudge, `attempts` table shown in the UI. |
| Hack Collective export (~450 rows) | `data/private/`, gitignored. Demo runs on the synthetic seed. |
| AI Pilled / Luma hosts | `LUMA_EVENT_IDS`. No LinkedIn scraping. |
| Open source | MIT `LICENSE`. Public repo. |
| Winning demo | An intro nobody typed by hand, end to end. Then a speaker shortlist with evidence. The attempt log shows who was skipped and which source failed. |

---

<!-- ===================================================== -->
<!-- ===== PART 0: SHARED (ALL AGENTS READ THIS) ========= -->
<!-- ===================================================== -->

# PART 0: Shared

## 0.1 What we are building

A community lead opens one page and can:

1. See who opted in and what they answered.
2. Run this week's introductions. Each consented member gets at most one partner. The reason quotes their tags ("Ben offers ui, which Ada wants"). A draft message is attached.
3. Run the same job as of 30 days later. Previous pairs are excluded. New intros appear with no one retyping anything.
4. Ask for speakers on a real topic. Members come from answers. Public names come from GitHub (London), Devpost, Hacker News, and Luma hosts. Each row has a source, a link or a quote, and a live/cache/fixture label.
5. Revive dead threads, or see why a thread was left alone.
6. Read the attempt log: no consent, no complement, partner already introduced, source error, rate limit.

People who did not opt in are never introduced and never listed as member-speakers.

## 0.2 Data flow

```
Seed or POST /api/answers
   │  members, tags, answer text, consent
   ▼
POST /api/intros/run   { asOf?: "YYYY-MM-DD" }   NDJSON
   [load]   consented members, answer text, prior intro pairs
   [match]  pickWeeklyPairs (pure code, frozen)
   [draft]  template always; LLM may replace the message, never the reasons
   [save]   intros for that week_start + attempt rows for skips
   [done]   IntroRunResult
   If that week_start already has rows, return them and do not call the model.

POST /api/speakers     { topic }                 JSON
   [members]  consented members whose tags match the topic words
   [public]   GitHub, Devpost, HN, Luma in parallel, 8s timeout each
   [why]      LLM writes one sentence per pick from evidence already gathered
   [save]     speaker_runs, speaker_picks, attempts
   A pick with no evidence is dropped. The model cannot add a name.

POST /api/threads/revive                          JSON
   [scan]   dead if last message ≥ 14 days ago and the thread has ≥ 3 messages
   [draft]  one nudge quoting the opening message
   [save]   revives + an attempt for every thread, including skips
```

Decisions every agent needs:

- **Code chooses people. The model writes sentences.** Reasons, scores, evidence URLs, and skip reasons are computed. A bad model response cannot invent a speaker or a pair.
- **Week identity is a date, not a timestamp.** `asOf` is `YYYY-MM-DD`, interpreted as a calendar day. `week_start` is the Monday of that week. Demo dates are fixed in A.2 so results are deterministic.
- **Idempotent weeks.** A second run for the same Monday returns the stored intros.
- **Consent is a hard filter** before scoring, except the attempt log, which records non-consent members as skipped.
- **Private data stays local.** Synthetic `data/seed.json` is the only committed member data.

## 0.3 Stack and environment

Next.js 15 (App Router), TypeScript strict, Tailwind, Supabase (Postgres only), `zod`, `openai` npm package as an OpenAI-compatible client. Deployed on Vercel. MIT licence.

Do not add Cognee, mem0, sentence-transformers, graphology, Baileys, or whatsapp-web.js. Supabase is the graph the brief allows. Unofficial WhatsApp clients break WhatsApp's terms; the outbound path is a message the lead copies, or a webhook.

`.env.example`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=sb_publishable_awgpuHIX-a75TJ4Wn-u7QA_E32ahZRR
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only

# LLM (OpenAI-compatible). Optional at runtime: templates cover a failed call.
LLM_BASE_URL=https://api.x.ai/v1
LLM_API_KEY=
LLM_MODEL=

# Speaker sources. Token optional (60 GitHub requests/hour without it).
GITHUB_TOKEN=
LUMA_EVENT_IDS=evt-Yz7RR89Zlv56tya

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
WEBHOOK_SECRET=change-me
ADMIN_SECRET=change-me
```

## 0.4 File ownership

Each agent edits only its own paths. If you need a change in someone else's file, stop and tell the human.

```
PLAN.md                                      [human]
LICENSE                                      [human]
AGENTS.md                                    [human, copy of 0.8]
docs/agent-log.md                            [all agents append]
.env.example                                 [human]
.gitignore                                   [human]  .env, data/private/, data/cache/
src/lib/contract/schema.ts                   [FROZEN, human at T0, copy of 0.6]
src/lib/contract/match.ts                    [FROZEN, human at T0, copy of 0.6]
src/lib/db/server.ts                         [human at T0]

supabase/migrations/0001_init.sql            [A]
data/seed.json                               [A]
scripts/seed.ts, verify-intros.ts,
        reset-demo.ts                        [A]

src/lib/llm/**                               [B]
src/lib/pipeline/**                          [B]
src/lib/sources/**                           [B]
src/app/api/**                               [B]
scripts/test-pipeline.ts                     [B]

src/app/page.tsx                             [C]
src/app/layout.tsx                           [C]
src/components/**                            [C]
src/fixtures/**                              [C]
```

There is no browser Supabase client. Member data is server-only. The page talks to the API routes.

## 0.5 Data model summary (full SQL is in PART A)

| Table | Columns |
|---|---|
| `communities` | id, name, slug |
| `members` | id, community_id, display_name, handle, consent_intros, offers text[], wants text[], builds text[], talks text[], links jsonb |
| `answers` | id, member_id, question_key (`building`/`wants`/`offers`/`talk`), question, answer |
| `messages` | id, community_id, member_id, thread_id, content, created_at |
| `intros` | id, week_start date, member_a, member_b, score, reasons jsonb, draft_message, created_at. Unique (week_start, member_a, member_b). `member_a` < `member_b` (uuid text order) |
| `speaker_runs` | id, topic, created_at |
| `speaker_picks` | id, run_id, name, kind (`member`/`public`), why, evidence jsonb |
| `attempts` | id, run_kind (`intro`/`speaker`/`thread`/`source`), status (`ok`/`skipped`/`error`), subject, detail, created_at |
| `revives` | id, thread_id, draft_message, created_at |

Tags are lowercase tokens. Scoring uses tags only. Answer sentences are the quotes shown in the UI. `links` is `{ github?: string, devpost?: string, hn?: string, site?: string }`.

Access: every table has RLS enabled and no anon policies. Server routes use the service role. Do not return emails or the service key to the client. The seed has no emails.

## 0.6 Frozen contract

Human copies this into `src/lib/contract/schema.ts` and `src/lib/contract/match.ts` at T0. Agents import it and do not edit it.

```ts
import { z } from "zod";

export const QuestionKey = z.enum(["building", "wants", "offers", "talk"]);

export const AsOf = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const IntroRunInput = z.object({
  asOf: AsOf.optional(), // default: today's date in Europe/London
});

export const Attempt = z.object({
  runKind: z.enum(["intro", "speaker", "thread", "source"]),
  status: z.enum(["ok", "skipped", "error"]),
  subject: z.string(),
  detail: z.string(),
});
export type Attempt = z.infer<typeof Attempt>;

export const IntroCard = z.object({
  weekStart: AsOf,
  memberA: z.string(),
  memberB: z.string(),
  score: z.number(),
  reasons: z.array(z.string()).min(1),
  quotes: z.object({ a: z.string(), b: z.string() }),
  draftMessage: z.string().max(400),
});
export type IntroCard = z.infer<typeof IntroCard>;

export const IntroRunResult = z.object({
  weekStart: AsOf,
  fromCache: z.boolean(),
  intros: z.array(IntroCard),
  attempts: z.array(Attempt),
});
export type IntroRunResult = z.infer<typeof IntroRunResult>;

export const Evidence = z.object({
  source: z.enum(["answers", "github", "devpost", "hn", "luma"]),
  label: z.enum(["live", "cache", "fixture"]),
  url: z.string().url().nullable(),
  text: z.string().min(1),
});
export type Evidence = z.infer<typeof Evidence>;

export const SpeakerPick = z.object({
  name: z.string(),
  kind: z.enum(["member", "public"]),
  why: z.string().max(400),
  evidence: z.array(Evidence).min(1),
});
export type SpeakerPick = z.infer<typeof SpeakerPick>;

export const SpeakerInput = z.object({
  topic: z.string().min(2).max(120),
});

export const SpeakerResult = z.object({
  topic: z.string(),
  picks: z.array(SpeakerPick).max(8),
  attempts: z.array(Attempt),
});
export type SpeakerResult = z.infer<typeof SpeakerResult>;

export const ReviveResult = z.object({
  revives: z.array(z.object({
    threadId: z.string(),
    draftMessage: z.string().max(400),
    quote: z.string(),
  })),
  attempts: z.array(Attempt),
});
export type ReviveResult = z.infer<typeof ReviveResult>;

export const AnswerInput = z.object({
  handle: z.string().min(1),
  consentIntros: z.boolean(),
  answers: z.object({
    building: z.string().max(500),
    wants: z.string().max(500),
    offers: z.string().max(500),
    talk: z.string().max(500),
  }),
  tags: z.object({
    offers: z.array(z.string()).max(8),
    wants: z.array(z.string()).max(8),
    builds: z.array(z.string()).max(8),
    talks: z.array(z.string()).max(8),
  }),
  links: z.object({
    github: z.string().optional(),
    devpost: z.string().optional(),
    hn: z.string().optional(),
    site: z.string().optional(),
  }).optional(),
});
export type AnswerInput = z.infer<typeof AnswerInput>;
```

`src/lib/contract/match.ts`:

```ts
export type Profile = {
  id: string;
  displayName: string;
  consentIntros: boolean;
  offers: string[];
  wants: string[];
  builds: string[];
  talks: string[];
};

export type ScoredPair = {
  a: Profile;
  b: Profile;
  score: number;
  reasons: string[];
  key: string;
};

const intersect = (a: string[], b: string[]) => a.filter((x) => b.includes(x));

export function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Monday of the calendar week that contains YYYY-MM-DD. Pure date math, no time zone. */
export function weekStart(asOf: string): string {
  const [y, m, d] = asOf.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const day = utc.getUTCDay(); // 0 Sun .. 6 Sat
  const delta = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

export function scorePair(a: Profile, b: Profile) {
  const aGets = intersect(a.wants, b.offers);
  const bGets = intersect(b.wants, a.offers);
  const reasons = [
    ...aGets.map((t) => `${b.displayName} offers ${t}, which ${a.displayName} wants`),
    ...bGets.map((t) => `${a.displayName} offers ${t}, which ${b.displayName} wants`),
  ];
  const complement = aGets.length + bGets.length;
  if (complement < 1) return { score: 0, reasons: [] as string[] };
  const shared = intersect(a.builds, b.builds).length + intersect(a.talks, b.talks).length;
  return { score: 3 * complement + shared, reasons };
}

/** One partner per member. Prior keys (any week) are excluded. Names ordered for display. */
export function pickWeeklyPairs(members: Profile[], usedPairKeys: Set<string>): ScoredPair[] {
  const eligible = members.filter((m) => m.consentIntros);
  const candidates: ScoredPair[] = [];
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const left = eligible[i];
      const right = eligible[j];
      const key = pairKey(left.id, right.id);
      if (usedPairKeys.has(key)) continue;
      const { score, reasons } = scorePair(left, right);
      if (score < 1) continue;
      const [a, b] = left.displayName < right.displayName ? [left, right] : [right, left];
      candidates.push({ a, b, score, reasons, key });
    }
  }
  candidates.sort(
    (p, q) =>
      q.score - p.score ||
      p.a.displayName.localeCompare(q.a.displayName) ||
      p.b.displayName.localeCompare(q.b.displayName),
  );
  const used = new Set<string>();
  const picked: ScoredPair[] = [];
  for (const c of candidates) {
    if (used.has(c.a.id) || used.has(c.b.id)) continue;
    used.add(c.a.id);
    used.add(c.b.id);
    picked.push(c);
  }
  return picked;
}

export function topicWords(topic: string) {
  return topic.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
}

export function memberTopicHits(m: Profile, topic: string) {
  const text = [...m.offers, ...m.wants, ...m.builds, ...m.talks].join(" ").toLowerCase();
  return topicWords(topic).filter((w) => text.includes(w));
}
```

Skip detail for a consented member left unmatched this week:

- They had a score ≥ 1 against someone, but that person was taken or the pair was used in an earlier week: `best partner already introduced`.
- Else: `no complement`.

Every member with `consentIntros = false` gets an attempt `skipped` / `no consent`, and is not paired.

Template draft (used when the LLM call is absent or invalid):

```
{A} — {B}. {first reason}. Want an intro this week?
```

DB client (human writes at T0): `src/lib/db/server.ts` exports `supabaseAdmin()` using `SUPABASE_SERVICE_ROLE_KEY`. Server code only.

## 0.7 API surface (frozen interface between B and C)

| Method and path | Body | Response |
|---|---|---|
| `POST /api/intros/run` | `IntroRunInput` | NDJSON stream of `{ step, status, ms?, data? }` then a final line `{ step: "done", status: "ok", data: IntroRunResult }` |
| `GET /api/intros?week=YYYY-MM-DD` | | `{ intros: IntroCard[] }` for that Monday |
| `POST /api/speakers` | `SpeakerInput` | `SpeakerResult` |
| `POST /api/threads/revive` | `{}` | `ReviveResult` |
| `GET /api/attempts` | | `{ attempts: (Attempt & { createdAt: string })[] }` newest first, max 50 |
| `GET /api/members` | | display name, handle, consent, tags, answers, links. No other columns. |
| `POST /api/answers` | `AnswerInput` plus header `x-webhook-secret` | `{ ok: true }` |
| `POST /api/admin/reset` | `{ secret }` equals `ADMIN_SECRET` | `{ ok: true }`. Deletes intros, speaker runs and picks, attempts, revives. Does not delete members. |

Intro stream steps, in order: `load`, `match`, `draft`, `save`, `done`. On failure: `{ step: "error", status: "error", data: { message } }` and the stream ends.

`POST /api/answers` upserts a member by `handle` inside the seed community and replaces that member's four answers and tags. It does not delete intros already sent.

## 0.8 Working rules (copy to `AGENTS.md`)

```
- TypeScript strict. No `any` unless commented why.
- Import types and matching from src/lib/contract. Never edit those files.
- Only edit files you own (PLAN.md section 0.4). If you need a change elsewhere, stop and tell the human.
- Never hard-code secrets. Read env vars. SUPABASE_SERVICE_ROLE_KEY is server only.
- Validate external input and LLM output with Zod.
- Do not invent evidence, handles, stars, or events. If a source fails, log an attempt and move on.
- Do not introduce a member with consent_intros = false. Do not commit data/private.
- Keep functions small and typed. No dead code. No unused dependencies.
- After each task: run typecheck and lint, commit with a clear message, and append one entry
  (task id, what was built, one line on the approach) to docs/agent-log.md.
- Do not add features outside your task list. Do not add Cognee, mem0, graphology,
  sentence-transformers, Baileys, or whatsapp-web.js.
```

---

<!-- ===================================================== -->
<!-- ===== PART A: AGENT A, DATA ========================= -->
<!-- ===================================================== -->

# PART A: Agent A (data)

**Prompt to paste into Cursor:**

```
You are Agent A (data), the data subagent. Read PLAN.md PART 0, the MVP section, and PART A only.
Build A1–A5 and stop. You own: supabase/migrations, data/seed.json, scripts/seed.ts,
scripts/verify-intros.ts, scripts/reset-demo.ts. Do not edit anything else. The contract in
PART 0 is frozen. Work on branch agent-a-data. Commit after each task and follow 0.8.
Matching is imported from src/lib/contract/match.ts once the human has added it.
Until that file exists, copy the functions locally in the verify script and delete the copy
when the frozen file lands. Do not change the algorithm.
```

## A.1 Migration: `supabase/migrations/0001_init.sql`

```sql
create extension if not exists pgcrypto;

create table communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null
);

create table members (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  display_name text not null,
  handle text not null,
  consent_intros boolean not null default false,
  offers text[] not null default '{}',
  wants text[] not null default '{}',
  builds text[] not null default '{}',
  talks text[] not null default '{}',
  links jsonb not null default '{}',
  unique (community_id, handle)
);

create table answers (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  question_key text not null check (question_key in ('building','wants','offers','talk')),
  question text not null,
  answer text not null,
  unique (member_id, question_key)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  thread_id text not null,
  content text not null,
  created_at timestamptz not null
);

create table intros (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  member_a uuid not null references members(id) on delete cascade,
  member_b uuid not null references members(id) on delete cascade,
  score float not null,
  reasons jsonb not null,
  draft_message text not null,
  created_at timestamptz not null default now(),
  unique (week_start, member_a, member_b),
  check (member_a::text < member_b::text)
);

create table speaker_runs (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  created_at timestamptz not null default now()
);

create table speaker_picks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references speaker_runs(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('member','public')),
  why text not null,
  evidence jsonb not null
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  run_kind text not null check (run_kind in ('intro','speaker','thread','source')),
  status text not null check (status in ('ok','skipped','error')),
  subject text not null,
  detail text not null,
  created_at timestamptz not null default now()
);

create table revives (
  id uuid primary key default gen_random_uuid(),
  thread_id text not null,
  draft_message text not null,
  created_at timestamptz not null default now()
);

alter table communities enable row level security;
alter table members enable row level security;
alter table answers enable row level security;
alter table messages enable row level security;
alter table intros enable row level security;
alter table speaker_runs enable row level security;
alter table speaker_picks enable row level security;
alter table attempts enable row level security;
alter table revives enable row level security;
```

No anon policies. Service role bypasses RLS.

## A.2 Seed specification

One community: **Southbank Builders**, slug `southbank`. Twelve members. Tags are exact. Do not add tags. Answer text is what the UI quotes; it is not scored.

Question labels stored with every answer: building = "What are you building?", wants = "What do you want help with?", offers = "What can you help others with?", talk = "What would you talk about for 10 minutes?".

| Name | Handle | Consent | offers | wants | builds | talks | github |
|---|---|---|---|---|---|---|---|
| Ada Okonkwo | ada | yes | rust, cli | ui | meetup-checkin | rust | |
| Ben Shah | ben | yes | ui | rust | devtools-site | design | |
| Chioma Adeyemi | chioma | yes | bots, discord | writing | onboarding-bot | community-bots | chioma-not-a-real-user |
| Dan Ellis | dan | yes | writing | bots | newsletter | community-ops | |
| Elena Petrova | elena | yes | python, data | production-ml | quant-notebook | research | |
| Farid Hassan | farid | yes | production-ml | data | eval-harness | evals | |
| Maya Rahman | maya | yes | desktop | cli | tauri-app | desktop | |
| Noah Grant | noah | yes | python | ui | charts | data-viz | |
| Iris Chen | iris | yes | | | | | |
| Jon Blake | jon | yes | | | | | |
| Kai Rahman | kai | **no** | rust | ui | rust-game | rust | |
| Leah Cohen | leah | **no** | writing | bots | notes | writing | |

Answers, one sentence each:

| Name | building | wants | offers | talk |
|---|---|---|---|---|
| Ada | A Rust CLI that checks people in at meetups. | Someone who has shipped a small UI. | Rust and CLIs. | Rust for people who write scripts. |
| Ben | A landing-page system for devtools. | A Rust person to pair with on a CLI. | UI and landing pages. | Designing for developers. |
| Chioma | An onboarding bot for my community. | A writer, so it sounds human. | Bots and Discord. | Community bots that don't annoy members. |
| Dan | A short newsletter for the group. | A bot person to try the ideas on. | Writing and community ops. | Getting members to answer questions. |
| Elena | A quant research notebook. | Someone who has put a model in production. | Python and data. | What our reading group actually reads. |
| Farid | An eval harness for support bots. | A data person with a real dataset. | Production ML. | Evals when you have 40 users. |
| Maya | A Tauri desktop app for the group. | A CLI review before I ship it. | Desktop apps. | Shipping a desktop app from a chat group. |
| Noah | Small charts for event attendance. | A UI pair. | Python. | Showing a community its own data. |
| Iris | Not much right now. | Nothing specific. Mostly lurking. | Not sure yet. | |
| Jon | Tinkering. | Nothing in particular. | Memes. | |
| Kai | A small Rust game. | A designer. | Rust. | Game dev in Rust. |
| Leah | Notes on how we write to members. | To see them used in a bot. | Writing. | Tone of voice for communities. |

Iris and Jon have empty tag arrays on purpose. Their prose must not leak into tags.

**Pairs `verify-intros.ts` must assert** (names, unordered):

Week of `2026-10-22` (`week_start` `2026-10-19`), score 6 each:

- Ada Okonkwo — Ben Shah
- Chioma Adeyemi — Dan Ellis
- Elena Petrova — Farid Hassan

Unmatched that week: Maya Rahman and Noah Grant (`best partner already introduced`), Iris Chen and Jon Blake (`no complement`). Kai Rahman and Leah Cohen absent from intros, present as `no consent`.

Week of `2026-11-21` (`week_start` `2026-11-16`), after the first week is stored:

- Ada Okonkwo — Maya Rahman (score 3)
- Ben Shah — Noah Grant (score 3)

No other intros that week. Kai still absent.

## A.3 Threads

Dates are absolute. Revival is judged against `2026-10-22` (dead = last message on or before `2026-10-08`, and at least 3 messages).

| thread_id | Messages | Last message | Authors | Expected |
|---|---|---|---|---|
| `rust-planning` | 4 | 2026-09-01 | Ada, Ben | revive |
| `bots` | 4 | 2026-09-10 | Chioma, Dan | revive |
| `lunch` | 3 | 2026-10-20 | Noah, Maya | skip: still active |
| `meme` | 1 | 2026-09-01 | Jon | skip: too thin |

Write casual 1-sentence lines. `rust-planning` must open with Ada: "anyone up for finally picking a date for the rust thing". `bots` must open with Chioma: "the onboarding bot went quiet after week two". Other lines can be short replies. `lunch` and `meme` only need to satisfy the counts and dates.

## A.4 Tasks

All five are MVP.

| ID | Task | Acceptance |
|---|---|---|
| A1 | `0001_init.sql` from A.1, plus a 5-line note in `docs/agent-log.md` on applying it in the Supabase SQL editor | Tables, checks, and RLS exist. No anon policies. |
| A2 | `data/seed.json` matching A.2 and A.3 exactly | 1 community, 12 members, 48 answers, 12 messages. Chioma's github is `chioma-not-a-real-user`. Kai and Leah have `consentIntros: false`. |
| A3 | Idempotent `scripts/seed.ts` | Row counts match the file. Running twice does not duplicate members, answers, or messages. |
| A4 | `scripts/verify-intros.ts` | Prints both weeks. Asserts the pairs, scores, skip reasons, and that Kai and Leah are never intro'd. Exits 0 on mismatch. |
| A5 | `scripts/reset-demo.ts` | Deletes intros, speaker runs, speaker picks, attempts, and revives. Members stay. Safe to run twice. |

---

<!-- ===================================================== -->
<!-- ===== PART B: AGENT B, PIPELINE ===================== -->
<!-- ===================================================== -->

# PART B: Agent B (pipeline)

**Prompt to paste into Cursor:**

```
You are Agent B (pipeline), the pipeline subagent. Read PLAN.md PART 0, the MVP section, and
PART B only. Build B2, B3, B4 (GitHub only), B5, B7, and B8, then stop. Drafts are the
template in 0.6. Do not build the LLM client, the reviver, Devpost, Hacker News, Luma, or
POST /api/answers. You own: src/lib/pipeline, src/lib/sources, src/app/api,
scripts/test-pipeline.ts. Do not edit anything else. The contract in PART 0 is frozen.
Work on branch agent-b-pipeline. Until the database is seeded, run matching against
data/seed.json in memory. Follow 0.8. Do not invent speaker evidence.
```

## B.1 LLM client: `src/lib/llm/client.ts`

`chatJSON<T>({ schema, system, user }): Promise<T>` using `openai` with `baseURL = LLM_BASE_URL` and `model = LLM_MODEL`. Request `response_format: { type: "json_object" }`. Validate with Zod. On failure, retry once with the Zod error appended. On a second failure, throw. If `LLM_API_KEY` is empty, throw immediately with `llm not configured` so callers can use the template.

## B.2 Intros: `src/lib/pipeline/intros.ts`

`runIntros(asOf: string): Promise<IntroRunResult>`

1. `weekStart(asOf)` from the frozen helper. Default `asOf` is the current date in `Europe/London`.
2. If `intros` already exist for that `week_start`, load them, set `fromCache: true`, and return. Do not call the model.
3. Load members and answers. Build `Profile`s. Load all historical pair keys.
4. `pickWeeklyPairs`. For each pair, quotes are the `wants` answer of A and of B (the sentence, not the tag).
5. Draft, MVP: use the template from 0.6 for every pair. Do not call a model. The later LLM path, left here for after the MVP, is one batched call. System prompt:

```
Write one intro message per pair, max 280 characters, warm and specific.
Use only the reasons and quotes provided. Do not add facts, events, or shared history.
Return ONLY JSON: { "drafts": [{ "key": "<pair key>", "message": "..." }] }
```

Keep a draft only when its `key` matches a pair. Everyone else gets the template from 0.6. Reasons always come from `scorePair`, never from the model.
6. Insert `intros` with member uuids ordered so `member_a` < `member_b`. Insert attempts: `ok` per pair, and the skip rules from 0.6.
7. Unmatched details use the rule in 0.6. Compute "had a positive score" by running `scorePair` against other consented members, ignoring the greedy take.

## B.3 Speaker sources: `src/lib/sources/`

MVP implements the GitHub row only. Devpost, Hacker News, and Luma are later.

Each source returns `{ evidence: Evidence[], attempts: Attempt[] }`. Timeout 8 seconds. Never throw past the gatherer.

| Source | Call | Who gets a pick |
|---|---|---|
| GitHub | `GET /search/users?q={topic} location:London&per_page=5` and `GET /users/{handle}` for member links. Header `Accept: application/vnd.github+json`, `User-Agent: know-your-members`. Auth header only if `GITHUB_TOKEN` is set. | A user hit: name, profile URL, `text` includes location and public repo count from the payload. A member handle 404 is an `error` attempt and does not become a pick. |
| Devpost | `GET https://devpost.com/software/search?query={topic}` with `Accept: application/json` | Top 5 projects: name, url, tagline, tags. Kind `public`. |
| Hacker News | `GET https://hn.algolia.com/api/v1/search?query={topic}&tags=story&hitsPerPage=5` | Story title, URL, author, points. Name is the author. Kind `public`. |
| Luma | `GET https://api.lu.ma/event/get?event_api_id={id}` for each id in `LUMA_EVENT_IDS` | Include a host only if the event name or description contains a `topicWords` token. Evidence text is the event name plus the host name. URL is `website` or `https://lu.ma/{event}` if no website. If nothing overlaps, one attempt `skipped` / `no host matched topic`. |

`label` is `live` when the response is HTTP 200. On any failure, if `src/fixtures/sources/community-bots.json` has that source and the topic is `community bots` (case insensitive), use it with `label: "fixture"` and an attempt `error` whose detail says the live call failed and the fixture was used. Otherwise skip the source.

Commit that fixture as real responses captured once during B4 (public API data only). Do not hand-write fake stars or fake people. If a capture fails, omit that source from the fixture and rely on the attempt log.

Member picks are separate from these sources. They are not fixture-backed.

## B.4 Speakers: `src/lib/pipeline/speakers.ts`

`findSpeakers(topic: string): Promise<SpeakerResult>`

1. Consented members with `memberTopicHits` length > 0, highest hit count first, max 4. Evidence: one `answers` item, `label: "live"`, `url: null`, `text` = their `talk` answer or, if empty, their `building` answer. Kind `member`.
2. Public sources via `Promise.allSettled`. A rejected source becomes an `error` attempt.
3. Cap the list at 8: all member picks, then public picks in source order GitHub, Devpost, HN, Luma.
4. MVP: set `why` to the first evidence `text`. Do not call a model. The later path is one LLM call. System prompt:

```
Write one sentence per person explaining why they fit the topic.
Use only the evidence text. If the evidence does not support a claim, say what the
evidence actually is. Return ONLY JSON: { "whys": [{ "name": "...", "why": "..." }] }
```

If the call fails or a name is missing, `why` is the first evidence `text`. Drop any model-invented name.
5. Persist the run, the picks, and the attempts, including Chioma's GitHub 404 when her handle is looked up.

## B.5 Thread reviver: `src/lib/pipeline/revive.ts`

`reviveThreads(today = "2026-10-22"): Promise<ReviveResult>`

Group `messages` by `thread_id`. Compare dates as `YYYY-MM-DD`.

- Last message date > today minus 14 days: attempt `skipped` / `still active`. No draft.
- Fewer than 3 messages: attempt `skipped` / `too thin`. No draft.
- Else: draft. Template: `Picking "{threadId}" back up — "{opening sentence}". Still worth it?`. LLM may replace the message; the opening sentence must still appear. Persist `revives` and an `ok` attempt.

Opening sentence is the earliest message in the thread.

## B.6 Routes

Implement 0.7. Validate bodies with Zod. `400` on bad input. `401` on a bad webhook or admin secret.

`POST /api/intros/run`: `application/x-ndjson`, `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 60`. Write each step as one JSON line.

`POST /api/answers`: check `x-webhook-secret` against `WEBHOOK_SECRET`. Upsert by handle in community `southbank`. Replace tags and the four answers. Ignore unknown handles only if the community is missing; otherwise create the member.

`GET /api/members` reads through the service role and returns the columns listed in 0.7.

## B.7 Tasks

MVP is B2, B3, B4 (GitHub only), B5, B7, B8. B1 and B6 are later. In the MVP, `draft` applies the 0.6 template and does not call a model. `why` on a speaker pick is the first evidence text.

| ID | When | Task | Acceptance |
|---|---|---|---|
| B1 | later | `chatJSON` with one retry | A malformed response is retried once, then throws. Empty `LLM_API_KEY` throws `llm not configured`. |
| B2 | MVP | `runIntros` against the seed in memory, then wired to Supabase | `asOf=2026-10-22` returns the three A.2 pairs, template drafts, and the skip attempts. Second call sets `fromCache: true`. |
| B3 | MVP | `asOf=2026-11-21` after week one is stored | Exactly Ada—Maya and Ben—Noah. Kai is in attempts, not in intros. |
| B4 | MVP | GitHub source only, plus `src/fixtures/sources/community-bots.json` for that source | A forced HTTP failure on topic `community bots` returns fixture evidence labelled `fixture` and an error attempt. A 404 on `chioma-not-a-real-user` is logged and adds no pick. |
| B5 | MVP | `findSpeakers` | Topic `community bots` includes Chioma (and may include Dan) with answer evidence, plus GitHub picks that actually returned. No pick has empty evidence. |
| B6 | later | `reviveThreads` | `rust-planning` and `bots` get drafts quoting their opening lines. `lunch` and `meme` are skipped with the A.3 reasons. |
| B7 | MVP | Routes: intros run, intros GET, speakers, attempts, members, reset | Reset removes intros and leaves members. No revive route. No answer webhook. |
| B8 | MVP | `scripts/test-pipeline.ts` | Runs both intro weeks and `community bots`. Prints attempts. Exits non-zero if an A.2 assertion fails. |

---

<!-- ===================================================== -->
<!-- ===== PART C: AGENT C, FRONTEND ===================== -->
<!-- ===================================================== -->

# PART C: Agent C (frontend)

**Prompt to paste into Cursor:**

```
You are Agent C (frontend), the frontend subagent. Read PLAN.md PART 0, the MVP section, and
PART C only. Build C1–C5 and stop. Do not build a reviver panel. You own: src/app/page.tsx,
src/app/layout.tsx, src/components, src/fixtures. Do not edit anything else. The contract
in PART 0 is frozen. Work on branch agent-c-frontend. Build against src/fixtures until the
API exists. Design for a projector first (1280px) and a phone (390px). Follow 0.8.
```

## C.1 Lead page: `/`

One server page, client panels where they call the API. This is the lead's view. Four regions:

1. **Members.** Consent shown as "opted in" or "no intros". Tags and the four answers. Kai and Leah visibly opted out.
2. **This week.** Button "Run this week" posts `{ asOf: "2026-10-22" }` to `/api/intros/run` and reads NDJSON (`fetch` + `ReadableStream`). Show the step line (`load`, `match`, `draft`, `save`) with a spinner, then a tick and milliseconds. Cards: the two names, score, reasons, both quotes, the draft, a Copy button. A second control, "Run a month later", posts `{ asOf: "2026-11-21" }` and renders that week underneath, not instead. If `fromCache` is true, show "Already ran this week".
3. **Speakers.** Text input defaulting to `community bots`, button "Find speakers". Each pick: name, kind (`member` or `public`), why, and evidence rows with source, label (`live` / `cache` / `fixture`), the text, and a link when `url` is set.
4. **Log.** Attempts from the intro run, the speaker result, and `GET /api/attempts`. Status is visible. No reviver block in the MVP.

Outbound questionnaire, shown as static text the lead can copy:

```
Four questions, reply only if you want to be introduced.
1. What are you building?
2. What do you want help with?
3. What can you help others with?
4. What would you talk about for 10 minutes?
No reply means you are not matched.
```

Empty, loading, and error states are required for every panel. A failed fetch shows the response text. Do not render a pair or a speaker that is missing reasons or evidence.

## C.2 Fixtures

`src/fixtures/demo.json` holds a valid `IntroRunResult` for `2026-10-19`, a second for `2026-11-16`, and a `SpeakerResult` for `community bots` with one member pick and one public GitHub pick. Use it only when `?fixture=1` is in the URL, so the UI can be built before the API. The default path calls the API.

## C.3 Tasks

All five are MVP. There is no reviver panel.

| ID | Task | Acceptance |
|---|---|---|
| C1 | Layout, members, questionnaire copy, fixture mode | At 1280px and 390px the four regions are readable. Kai reads as not opted in. |
| C2 | Intro runner, both weeks, streaming steps, Copy | `?fixture=1` shows the three week-one pairs and the two later pairs at the same time. Steps render. |
| C3 | Speaker panel | Every pick shows kind, why, source, and label. Fixture picks with no evidence are not rendered. |
| C4 | Attempt log | Skip reasons from the fixture are on screen, including `no consent` and a source error. |
| C5 | Wire default mode to the live API, drop fixture-only copy from the happy path | Buttons hit intros, speakers, members, and attempts. Errors are visible. `?fixture=1` still works with the API down. |

---

<!-- ===================================================== -->
<!-- ===== PART H: HUMAN ONLY (DO NOT GIVE TO AGENTS) ==== -->
<!-- ===================================================== -->

# PART H: Human integrator

## H.1 Before agents start

- Supabase project. No pgvector requirement.
- `.env` from 0.3. `.env.example` committed. `.gitignore` includes `.env`, `data/private/`, `data/cache/`.
- `LICENSE` MIT. `src/lib/contract/schema.ts`, `src/lib/contract/match.ts`, `src/lib/db/server.ts`, `AGENTS.md`, `docs/agent-log.md`.
- Scaffold Next.js 15, TypeScript, Tailwind. Install `zod`, `openai`, `@supabase/supabase-js`.
- If the room shares the Hack Collective export, put it in `data/private/` and do not commit it. The demo does not need it.
- Commit `main`, then branches `agent-a-data`, `agent-b-pipeline`, `agent-c-frontend`.

## H.2 Timeline

External deadlines do not move: feature freeze 21:15, code freeze 21:50, demo 22:20.

| Time | Human | Agents |
|---|---|---|
| 19:00–19:20 | T0 scaffold and frozen contract | |
| 19:20–20:05 | Apply migration when A1 lands. Answer questions. | A1–A5, B1–B2, C1–C2 |
| **M1, 20:05** | Merge A. Seed. `verify-intros.ts` exits 0. | B switches off the in-memory seed |
| 20:05–20:45 | Merge B and C as tasks land | B3–B8, C3–C5 |
| **M2, 20:45** | End to end on `/`: week one, month later, speakers, log | Fix integration only |
| 20:45–21:15 | Deploy. Rehearse the script twice. Record a backup video. | Bugfixes only |
| **21:15** | Feature freeze | |
| 21:15–21:50 | Confirm the production URL. Submit the public repo. | |

Merge order is A, then B, then C.

## H.3 Demo script (3 minutes)

1. **(0:00)** "Most leads know a member as a phone number. Intros don't happen, and the panel is whoever you already know."
2. **(0:20)** Members list. Point at Kai: "He answered. He did not opt in. He will not be introduced."
3. **(0:35)** Run this week. While it streams: "The match is code. The message is a template filled from their answers."
4. **(1:00)** Ada and Ben. Read the reason and her sentence about the Rust CLI. "Nobody typed this intro."
5. **(1:25)** Run a month later. Ada now meets Maya. "Same job, later Monday, previous pair excluded. The organiser is not in it."
6. **(1:50)** Speakers, topic `community bots`. Chioma's row cites her answer. A public row cites a GitHub profile URL. Say the label out loud if it says `fixture`.
7. **(2:25)** Log: Kai `no consent`, Iris `no complement`, Chioma's GitHub handle `error`. "This is the run we would trust next week."
8. **(2:40)** "Cursor built it as three agents on one contract. The database is what makes next month work. The words are a template until we turn the model on."

## H.4 How it's judged

Track 2 scores the intros, the speaker picks, the evidence, the honesty of the log, and whether a lead would run it every week. All tracks also use the six shared criteria, 1–5.

| Criterion | How we hit it |
|---|---|
| Intro and speaker quality | Designed complements, not shared buzzwords. Public picks are people the APIs returned for the topic. |
| Evidence | Reasons from tags, quotes from answers, public rows have URLs. |
| Honesty | Attempt log, opt-out visible, fixture labelled as fixture. |
| Would a lead run it weekly | One idempotent run per Monday. Month-later uses the same button. |
| Technical execution | Frozen matcher, Zod on every boundary, source timeouts, model cannot add names. |
| Grok Bot and Cursor | Three parallel agents on one contract. MVP copy is templated from answers. Grok writes the sentences only after the page works. |
| Community context | The intro cites what that member said they want and offer. |
| 10× to 20× | A week of intros and a sourced shortlist in one pass, versus asking around. |
| Real-world usefulness | Consent, a copyable questionnaire, a log you can check before sending. |
| Demo quality | Two weeks on one screen, then the shortlist, then the failures. |

## H.5 Risks, cuts, stretch

| Risk | Mitigation |
|---|---|
| Grok Bot's real webhook is unknown | `/api/answers` is the adapter. The page runs the demo with the seed. |
| Model is slow or unkeyed | Templates from 0.6. Reasons never depend on the model. `maxDuration = 60`. |
| GitHub rate limit or a dead API | 8s timeout, fixture for `community bots`, label it, log it. |
| Model invents a speaker | Code drops unknown names. Evidence is required by Zod. |
| Someone commits the 450-row export | `.gitignore` on `data/private/`. Say it again at M1. |
| Live demo fails | Backup recording before 21:15. |
| Agents collide | File ownership, frozen contract, merge A then B then C. |
| Luma event doesn't match the topic | That is a skip row, not a broken demo. Speaker proof can come from another source. |

The MVP section is the build. Thread reviver, Devpost, Hacker News, Luma, the LLM client, and the answer webhook stay unstarted until that page works. **Never cut from the MVP:** consent filter, week-one intros with reasons and quotes, month-later rerun, speaker shortlist with GitHub evidence or a labelled fixture, attempt log.

**Stretch, only after M2:** Notion database sync of this week's intros (`NOTION_TOKEN`), a Discord incoming webhook post of one draft, a loader that maps `data/private` columns onto `AnswerInput` without committing the file. Cognee is a partner option, not a demo dependency; do not start it after 20:45.

**Open questions for the room:**

1. How does Grok Bot deliver a message and a reply (webhook, tool call, or poll)?
2. Which Grok model name is on the key they give us?
3. Where is the submission form, and does the demo URL have to be public?
4. Which Luma event ids match the topic we will type on stage?
5. Is the Hack Collective file available, and which columns does it use? Demo stays on synthetic data either way.
