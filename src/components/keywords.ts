import { z } from "zod";

const STOP = new Set([
  "a", "an", "the", "and", "or", "to", "of", "for", "on", "in", "with",
  "my", "im", "am", "is", "are", "be", "this", "that", "it", "at", "from",
  "who", "what", "your", "you", "we", "our", "me", "do", "not", "just",
  "into", "about", "like", "so", "if", "as", "by", "up", "out", "they",
  "them", "their", "but", "have", "has", "had", "someone", "something",
  "working", "work", "want", "help",
]);

export const linksSchema = z.object({
  github: z.string().optional(),
  devpost: z.string().optional(),
  hn: z.string().optional(),
  site: z.string().optional(),
});

export const memberCardSchema = z.object({
  displayName: z.string(),
  handle: z.string(),
  consentIntros: z.boolean(),
  offers: z.array(z.string()),
  wants: z.array(z.string()),
  builds: z.array(z.string()),
  talks: z.array(z.string()),
  answers: z.object({
    building: z.string(),
    wants: z.string(),
    offers: z.string(),
    talk: z.string(),
  }),
  links: linksSchema.optional(),
});

export const membersResponseSchema = z.object({
  members: z.array(memberCardSchema),
});

export type MemberCard = z.infer<typeof memberCardSchema>;
export type RankedMember = MemberCard & { shared: string[] };

// shortcut: only a trailing s is stripped, so "bots" matches "bot" and "check-in" does not match "checkin".
function stem(word: string): string {
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2 && !STOP.has(word));
}

export function queryWords(text: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const word of tokens(text)) {
    const key = stem(word);
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  return words;
}

function haystack(member: MemberCard): string {
  return [
    member.offers.join(" "),
    member.wants.join(" "),
    member.builds.join(" "),
    member.talks.join(" "),
    member.answers.building,
    member.answers.wants,
    member.answers.offers,
    member.answers.talk,
  ].join(" ");
}

export function rankMembers(query: string, members: MemberCard[]): RankedMember[] {
  const words = queryWords(query);
  if (words.length === 0) return [];
  return members
    .filter((member) => member.consentIntros)
    .map((member) => {
      const keys = new Set(tokens(haystack(member)).map(stem));
      const shared = words.filter((word) => keys.has(stem(word)));
      return { member, shared };
    })
    .filter((hit) => hit.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length || a.member.displayName.localeCompare(b.member.displayName))
    .map((hit) => ({ ...hit.member, shared: hit.shared }));
}
