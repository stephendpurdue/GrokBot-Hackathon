import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pairKey, pickWeeklyPairs, scorePair, weekStart, type Profile } from "../src/lib/contract/match";

type SeedMember = {
  displayName: string;
  handle: string;
  consentIntros: boolean;
  offers: string[];
  wants: string[];
  builds: string[];
  talks: string[];
  links: { github?: string };
  answers: { building: string; wants: string; offers: string; talk: string };
};

type Seed = {
  community: { slug: string };
  members: SeedMember[];
  messages: Array<{ threadId: string; handle: string; content: string; createdAt: string }>;
};

const failures: string[] = [];

function expect(cond: boolean, message: string) {
  if (!cond) failures.push(message);
}

function skips(members: Profile[], pickedIds: Set<string>) {
  const eligible = members.filter((member) => member.consentIntros);
  const rows: Array<[string, string]> = [];
  for (const member of members) {
    if (!member.consentIntros) {
      rows.push([member.displayName, "no consent"]);
      continue;
    }
    if (pickedIds.has(member.id)) continue;
    const had = eligible.some((other) => other.id !== member.id && scorePair(member, other).score >= 1);
    rows.push([member.displayName, had ? "best partner already introduced" : "no complement"]);
  }
  return rows;
}

function main() {
  const seed = JSON.parse(readFileSync(resolve(process.cwd(), "data/seed.json"), "utf8")) as Seed;
  const answers = seed.members.reduce((sum, member) => sum + Object.keys(member.answers).length, 0);
  expect(seed.community.slug === "southbank", "community slug");
  expect(seed.members.length === 12, `members ${seed.members.length}`);
  expect(answers === 48, `answers ${answers}`);
  expect(seed.messages.length === 12, `messages ${seed.messages.length}`);
  const chioma = seed.members.find((member) => member.handle === "chioma");
  expect(chioma?.links.github === "chioma-not-a-real-user", "chioma github handle");
  expect(seed.members.find((member) => member.handle === "kai")?.consentIntros === false, "kai consent");
  expect(seed.members.find((member) => member.handle === "leah")?.consentIntros === false, "leah consent");
  expect(
    seed.messages.some((message) => message.threadId === "rust-planning" && message.content.startsWith("anyone up for finally picking a date")),
    "rust opening",
  );
  expect(
    seed.messages.some((message) => message.threadId === "bots" && message.content.startsWith("the onboarding bot went quiet")),
    "bots opening",
  );

  const profiles: Profile[] = seed.members.map((member) => ({
    id: member.handle,
    displayName: member.displayName,
    consentIntros: member.consentIntros,
    offers: member.offers,
    wants: member.wants,
    builds: member.builds,
    talks: member.talks,
  }));

  expect(weekStart("2026-10-22") === "2026-10-19", "week of 2026-10-22");
  expect(weekStart("2026-11-21") === "2026-11-16", "week of 2026-11-21");

  const week1 = pickWeeklyPairs(profiles, new Set());
  console.log("week 2026-10-22 (2026-10-19)");
  for (const pair of week1) console.log(`  ${pair.a.displayName} — ${pair.b.displayName} (${pair.score})`);
  const week1Names = week1.map((pair) => `${pair.a.displayName}|${pair.b.displayName}|${pair.score}`);
  expect(
    JSON.stringify(week1Names) ===
      JSON.stringify([
        "Ada Okonkwo|Ben Shah|6",
        "Chioma Adeyemi|Dan Ellis|6",
        "Elena Petrova|Farid Hassan|6",
      ]),
    `week 1 pairs ${week1Names.join(", ")}`,
  );
  const week1Skips = skips(profiles, new Set(week1.flatMap((pair) => [pair.a.id, pair.b.id])));
  for (const [name, detail] of week1Skips) console.log(`  skip ${name}: ${detail}`);
  expect(
    JSON.stringify(week1Skips) ===
      JSON.stringify([
        ["Maya Rahman", "best partner already introduced"],
        ["Noah Grant", "best partner already introduced"],
        ["Iris Chen", "no complement"],
        ["Jon Blake", "no complement"],
        ["Kai Rahman", "no consent"],
        ["Leah Cohen", "no consent"],
      ]),
    `week 1 skips ${JSON.stringify(week1Skips)}`,
  );

  const used = new Set(week1.map((pair) => pair.key));
  expect(used.has(pairKey("ada", "ben")), "stored pair key");
  const week2 = pickWeeklyPairs(profiles, used);
  console.log("week 2026-11-21 (2026-11-16)");
  for (const pair of week2) console.log(`  ${pair.a.displayName} — ${pair.b.displayName} (${pair.score})`);
  const week2Names = week2.map((pair) => `${pair.a.displayName}|${pair.b.displayName}|${pair.score}`);
  expect(
    JSON.stringify(week2Names) === JSON.stringify(["Ada Okonkwo|Maya Rahman|3", "Ben Shah|Noah Grant|3"]),
    `week 2 pairs ${week2Names.join(", ")}`,
  );
  const introNames = [...week1, ...week2].flatMap((pair) => [pair.a.displayName, pair.b.displayName]);
  expect(!introNames.includes("Kai Rahman") && !introNames.includes("Leah Cohen"), "kai and leah intro'd");

  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  console.log("ok");
}

main();
