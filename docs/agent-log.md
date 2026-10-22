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
