import { IntroRunResult, SpeakerResult } from "../src/lib/contract/schema";
import { gatherGitHub } from "../src/lib/sources/github";
import { runIntros } from "../src/lib/pipeline/intros";
import { findSpeakers } from "../src/lib/pipeline/speakers";
import { loadEnvFile } from "./env";

loadEnvFile();

const failures: string[] = [];

function expect(cond: boolean, message: string) {
  if (!cond) failures.push(message);
}

function names(result: { intros: Array<{ memberA: string; memberB: string; score: number }> }) {
  return result.intros.map((card) => `${card.memberA}|${card.memberB}|${card.score}`);
}

async function main() {
  const week1 = IntroRunResult.parse(await runIntros("2026-10-22"));
  console.log("week 2026-10-22", names(week1).join(", "), "cache", week1.fromCache);
  expect(!week1.fromCache, "week 1 should be a fresh run");
  expect(
    JSON.stringify(names(week1)) ===
      JSON.stringify([
        "Ada Okonkwo|Ben Shah|6",
        "Chioma Adeyemi|Dan Ellis|6",
        "Elena Petrova|Farid Hassan|6",
      ]),
    `week 1 pairs ${names(week1).join(", ")}`,
  );
  expect(week1.intros.every((card) => card.draftMessage.includes("Want an intro this week?")), "template draft");
  expect(week1.attempts.some((attempt) => attempt.subject === "Kai Rahman" && attempt.detail === "no consent"), "kai skip");
  expect(week1.attempts.some((attempt) => attempt.subject === "Leah Cohen" && attempt.detail === "no consent"), "leah skip");
  expect(week1.attempts.some((attempt) => attempt.subject === "Iris Chen" && attempt.detail === "no complement"), "iris skip");
  expect(
    week1.attempts.some((attempt) => attempt.subject === "Maya Rahman" && attempt.detail === "best partner already introduced"),
    "maya skip",
  );
  expect(!week1.intros.some((card) => card.memberA === "Kai Rahman" || card.memberB === "Kai Rahman"), "kai intro");

  const again = await runIntros("2026-10-22");
  expect(again.fromCache, "second week 1 run should be cached");

  const week2 = IntroRunResult.parse(await runIntros("2026-11-21"));
  console.log("week 2026-11-21", names(week2).join(", "));
  expect(
    JSON.stringify(names(week2)) === JSON.stringify(["Ada Okonkwo|Maya Rahman|3", "Ben Shah|Noah Grant|3"]),
    `week 2 pairs ${names(week2).join(", ")}`,
  );
  expect(!week2.intros.some((card) => `${card.memberA} ${card.memberB}`.includes("Kai")), "kai still absent");

  const forced = await gatherGitHub("community bots", ["chioma-not-a-real-user"], async (input) => {
    const url = String(input);
    if (url.includes("chioma-not-a-real-user")) return new Response("missing", { status: 404 });
    throw new Error("network down");
  });
  expect(forced.evidence.some((item) => item.label === "fixture" && item.url), "fixture evidence");
  expect(
    forced.attempts.some((attempt) => attempt.status === "error" && attempt.detail.includes("fixture was used")),
    "fixture attempt",
  );
  expect(
    forced.attempts.some((attempt) => attempt.subject === "chioma-not-a-real-user" && attempt.status === "error"),
    "chioma 404",
  );
  expect(!forced.names.includes("chioma-not-a-real-user"), "404 is not a pick");

  const speakers = SpeakerResult.parse(await findSpeakers("community bots"));
  console.log("speakers", speakers.picks.map((pick) => `${pick.kind}:${pick.name}`).join(", "));
  const chioma = speakers.picks.find((pick) => pick.name === "Chioma Adeyemi");
  expect(Boolean(chioma && chioma.kind === "member" && chioma.evidence[0]?.source === "answers"), "chioma member pick");
  expect(chioma?.evidence[0]?.text === "Community bots that don't annoy members.", "chioma quote");
  expect(speakers.picks.every((pick) => pick.evidence.length > 0 && pick.why.length > 0), "evidence required");
  expect(speakers.picks.some((pick) => pick.kind === "public" && pick.evidence[0]?.source === "github"), "github pick");
  expect(!speakers.picks.some((pick) => pick.name === "Kai Rahman" || pick.name === "Leah Cohen"), "opted out speakers");
  console.log("attempts");
  for (const attempt of [...week1.attempts, ...week2.attempts, ...speakers.attempts, ...forced.attempts]) {
    console.log(`  ${attempt.status} ${attempt.runKind} ${attempt.subject}: ${attempt.detail}`);
  }

  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  console.log("ok");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
