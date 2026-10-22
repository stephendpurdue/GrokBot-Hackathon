# Agent log

Append one entry per task: task id, what was built, one line on the approach.

## A1
`supabase/migrations/0001_init.sql`. Tables, checks, and RLS with no anon policies.
Apply it in the Supabase SQL editor: New query, paste the file, run. The service role bypasses RLS.

## A2
`data/seed.json`. One community, 12 members, 48 answers, 12 messages, copied from the spec.

## A3
`scripts/seed.ts`. Upserts the community, members, and answers, then replaces the seed threads so a second run does not duplicate rows.

## A4
`scripts/verify-intros.ts`. Runs the frozen matcher on the seed and exits non-zero when a pair, score, or skip reason drifts.

## A5
`scripts/reset-demo.ts`. Deletes intros, speaker runs, picks, attempts, and revives. Members stay, and a second run is a no-op.

## B2
`runIntros` for 2026-10-22. Code picks the three pairs, the 0.6 template writes the draft, and a second call returns `fromCache`.

## B3
The same job with `asOf` 2026-11-21. Prior pair keys are excluded, so the new week is Ada–Maya and Ben–Noah.

## B4
GitHub source plus `src/fixtures/sources/community-bots.json`. A failed call for `community bots` uses that captured response and labels it `fixture`. Chioma's missing handle is an error, not a pick.

## B5
`findSpeakers`. Consented tag hits become member picks; GitHub hits keep the payload text as `why`.

## B7
Routes for intros, speakers, attempts, members, and admin reset. No revive route and no answer webhook.

## B8
`scripts/test-pipeline.ts`. Runs both intro weeks and `community bots`, prints attempts, and exits non-zero if an A.2 assertion fails.

## C1
Lead page with members, the copyable questionnaire, and `?fixture=1`. Kai and Leah read as "no intros".

## C2
Intro runner. Fixture mode shows both weeks at once. Live mode streams `load`, `match`, `draft`, and `save`, then copies the draft.

## C3
Speaker panel. Each rendered pick has kind, why, source, and label. A pick with no evidence is dropped.

## C4
Attempt log. Fixture mode shows `no consent`, `no complement`, and the GitHub source error.

## C5
Default mode calls the live routes. A failed response is shown as text. `?fixture=1` still renders with the API down.

## C6
Hinge-style deck on `/`. A typed line is tokenised and scored against consented members; swipe right keeps a session connect, swipe left advances.

## B4
GitHub search stays on `"{topic} location:London"`. An empty result for `community bots` uses the captured fixture and an error attempt.

## B1
`chatJSON` validates with Zod and retries once. A missing key or model throws `llm not configured`, and intro drafts plus speaker sentences fall back to the template and the evidence text.

## B6
`reviveThreads` drafts nudges for `rust-planning` and `bots`, and skips `lunch` and `meme`. The lead page shows the drafts.

## sources
Devpost, Hacker News, and Luma run beside GitHub. A source that fails is an attempt. Luma with no topic overlap is `no host matched topic`.

## answers
`POST /api/answers` checks `x-webhook-secret` and upserts the Southbank member, tags, and four answers.

## crowd
`src/components/crowd.ts`. The deck mixes 320 synthetic members, drawn across a 93-word bank, in with the loaded people. The seed file stays at twelve so intro checks do not move.

## HOME
Landing page at `/` with three slow colour washes. The deck moved to `/demo`, reached from “Open the demo”.

## menu
Side menu on every screen lists saved connections and links to `/settings` and `/account`. A right swipe writes the person into localStorage; the account name is stored the same way.

## palette
The menu is a command palette. ⌘K opens it, search filters pages and connections, and the installed Motion package springs the dialog and the selection highlight.

## C7
Deck page background drifts with the same washes. Each card also shows the offer, the talk, the project tag, and offers/wants/builds/talks, with shared words filled in.

## swipe
The deck paints a drag on the card node, so a swipe does not re-render both faces. The form starts on the local crowd, and the member load reads members and answers together.

## C8
Deck backdrop is sharp rings and marks that track the pointer. The blurred washes stay on the landing page.

## C9
Deck cards have a hard edge on a flat `#f3efe8` page. The shadow and the faded card behind are gone.

## theme
Command palette command switches light and dark. A cookie sets `html.dark` on the next load, and dark mode remaps the stone variables while button labels and card photos stay readable.

## welcome
Homepage names the three steps and who appears. Same washes and type; the deck stays at `/demo`.

## profile
View profile on a confirmed connection opens `/connections/[handle]`. The swipe stores answers, tags, and links; the page shows shared words and http(s) contact links.
