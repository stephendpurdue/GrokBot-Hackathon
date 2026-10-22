import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { Profile } from "../contract/match";
import { tryDb } from "./db";

const Links = z.object({
  github: z.string().optional(),
  devpost: z.string().optional(),
  hn: z.string().optional(),
  site: z.string().optional(),
});

export type Person = Profile & {
  handle: string;
  buildingAnswer: string;
  wantsAnswer: string;
  offersAnswer: string;
  talkAnswer: string;
  links: z.infer<typeof Links>;
};

type Seed = {
  members: Array<{
    displayName: string;
    handle: string;
    consentIntros: boolean;
    offers: string[];
    wants: string[];
    builds: string[];
    talks: string[];
    links?: z.infer<typeof Links>;
    answers: { building: string; wants: string; offers: string; talk: string };
  }>;
};

function fromSeed(): Person[] {
  const seed = JSON.parse(readFileSync(resolve(process.cwd(), "data/seed.json"), "utf8")) as Seed;
  return seed.members.map((member) => ({
    id: member.handle,
    handle: member.handle,
    displayName: member.displayName,
    consentIntros: member.consentIntros,
    offers: member.offers,
    wants: member.wants,
    builds: member.builds,
    talks: member.talks,
    buildingAnswer: member.answers.building,
    wantsAnswer: member.answers.wants,
    offersAnswer: member.answers.offers,
    talkAnswer: member.answers.talk,
    links: member.links ?? {},
  }));
}

export async function loadPeople(): Promise<Person[]> {
  const db = tryDb();
  if (!db) return fromSeed();

  const { data: members, error } = await db
    .from("members")
    .select("id, display_name, handle, consent_intros, offers, wants, builds, talks, links");
  if (error) throw new Error(error.message);
  const { data: answers, error: answerError } = await db
    .from("answers")
    .select("member_id, question_key, answer");
  if (answerError) throw new Error(answerError.message);

  const memberRows = z.array(z.object({
    id: z.string(),
    display_name: z.string(),
    handle: z.string(),
    consent_intros: z.boolean(),
    offers: z.array(z.string()),
    wants: z.array(z.string()),
    builds: z.array(z.string()),
    talks: z.array(z.string()),
    links: Links.nullable().optional(),
  })).parse(members ?? []);
  const answerRows = z.array(z.object({
    member_id: z.string(),
    question_key: z.enum(["building", "wants", "offers", "talk"]),
    answer: z.string(),
  })).parse(answers ?? []);

  const byMember = new Map<string, Partial<Record<"building" | "wants" | "offers" | "talk", string>>>();
  for (const row of answerRows) {
    const bucket = byMember.get(row.member_id) ?? {};
    bucket[row.question_key] = row.answer;
    byMember.set(row.member_id, bucket);
  }

  return memberRows.map((member) => {
    const answersForMember = byMember.get(member.id) ?? {};
    return {
      id: member.id,
      handle: member.handle,
      displayName: member.display_name,
      consentIntros: member.consent_intros,
      offers: member.offers,
      wants: member.wants,
      builds: member.builds,
      talks: member.talks,
      buildingAnswer: answersForMember.building ?? "",
      wantsAnswer: answersForMember.wants ?? "",
      offersAnswer: answersForMember.offers ?? "",
      talkAnswer: answersForMember.talk ?? "",
      links: member.links ?? {},
    };
  });
}

export function memberView(people: Person[]) {
  return people.map((person) => ({
    displayName: person.displayName,
    handle: person.handle,
    consentIntros: person.consentIntros,
    offers: person.offers,
    wants: person.wants,
    builds: person.builds,
    talks: person.talks,
    answers: {
      building: person.buildingAnswer,
      wants: person.wantsAnswer,
      offers: person.offersAnswer,
      talk: person.talkAnswer,
    },
    links: person.links,
  }));
}
