import assert from "node:assert/strict";
import { dummyMembers, KEYWORD_BANK } from "./crowd";
import type { MemberCard } from "./keywords";
import { queryWords, rankMembers } from "./keywords";

function member(partial: Pick<MemberCard, "displayName" | "handle" | "consentIntros"> & Partial<MemberCard>): MemberCard {
  return {
    offers: [],
    wants: [],
    builds: [],
    talks: [],
    answers: { building: "", wants: "", offers: "", talk: "" },
    ...partial,
  };
}

const people: MemberCard[] = [
  member({
    displayName: "Ada Okonkwo",
    handle: "ada",
    consentIntros: true,
    offers: ["rust", "cli"],
    wants: ["ui"],
    builds: ["meetup-checkin"],
    answers: { building: "A Rust CLI that checks people in at meetups.", wants: "", offers: "", talk: "" },
  }),
  member({
    displayName: "Ben Shah",
    handle: "ben",
    consentIntros: true,
    offers: ["ui"],
    wants: ["rust"],
    answers: { building: "A landing-page system for devtools.", wants: "A Rust person to pair with on a CLI.", offers: "", talk: "" },
  }),
  member({
    displayName: "Chioma Adeyemi",
    handle: "chioma",
    consentIntros: true,
    offers: ["bots"],
    answers: { building: "An onboarding bot for my community.", wants: "", offers: "", talk: "Community bots that don't annoy members." },
  }),
  member({
    displayName: "Kai Rahman",
    handle: "kai",
    consentIntros: false,
    offers: ["rust"],
    builds: ["rust-game"],
    answers: { building: "A small Rust game.", wants: "", offers: "", talk: "" },
  }),
  member({
    displayName: "Leah Cohen",
    handle: "leah",
    consentIntros: false,
    offers: ["writing"],
    answers: { building: "Notes on how we write to members.", wants: "", offers: "", talk: "" },
  }),
];

assert.deepEqual(queryWords("I am working on a rust CLI"), ["rust", "cli"]);
assert.deepEqual(queryWords("a to the"), []);

const rust = rankMembers("rust cli for meetups", people);
assert.equal(rust[0]?.handle, "ada");
assert.equal(rust.some((person) => person.handle === "kai"), false);
assert.ok(rust[0]?.shared.includes("rust") && rust[0]?.shared.includes("cli"));

const bots = rankMembers("community bots", people);
assert.equal(bots[0]?.handle, "chioma");
assert.equal(bots.some((person) => person.handle === "leah"), false);

assert.equal(rankMembers("quantum origami", people).length, 0);

const crowd = dummyMembers();
assert.equal(crowd.length, 320);
assert.equal(KEYWORD_BANK.length % 2, 1);
assert.equal(new Set(crowd.map((person) => person.handle)).size, crowd.length);
assert.ok(crowd.every((person) => person.consentIntros));
assert.equal(rankMembers("quantum origami", crowd).length, 0);
for (const word of KEYWORD_BANK) {
  assert.ok(rankMembers(word, crowd).length >= 10, word);
}
assert.equal(rankMembers("UI", people).some((person) => person.handle === "ben"), true);
assert.equal(rankMembers("UI", people).some((person) => person.handle === "kai"), false);

console.log("keywords.check ok");
