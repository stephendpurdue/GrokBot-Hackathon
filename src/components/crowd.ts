import type { MemberCard } from "./keywords";

// Odd length so a stride of 4 still visits every word. Glue sentences use stop-words only.
export const KEYWORD_BANK = [
  "rust", "python", "go", "typescript", "swift", "kotlin", "elixir", "haskell", "zig", "clojure",
  "ruby", "sql", "wasm", "llvm",
  "cli", "ui", "bots", "discord", "writing", "design", "desktop", "mobile", "ios", "android",
  "react", "nextjs", "tauri", "electron", "graphql", "webrtc",
  "postgres", "supabase", "redis", "kafka", "docker", "kubernetes", "terraform", "nix", "linux",
  "serverless", "sqlite", "queues",
  "ml", "evals", "embeddings", "agents", "llm", "rag", "nlp", "vision", "prompting", "finetune",
  "onboarding", "moderation", "newsletters", "events", "workshops", "mentoring", "docs",
  "facilitation", "analytics", "charts",
  "climate", "energy", "health", "education", "music", "games", "audio", "maps", "transit",
  "housing", "journalism", "archives", "civic", "robotics", "hardware", "sensors", "drones",
  "payments", "privacy", "security", "auth", "accessibility", "i18n", "observability",
  "testing", "compilers", "embedded", "crdt", "fundraising", "grants", "film", "animation",
  "typography",
] as const;

const FIRST = [
  "Amina", "Jonah", "Priya", "Owen", "Sofia", "Marcus", "Hana", "Leo", "Nadia", "Yara",
  "Theo", "Ines", "Omar", "Freya", "Jules", "Soren", "Mei", "Idris", "Rosa", "Kenji",
];

const LAST = [
  "Okeke", "Brooks", "Singh", "Nguyen", "Almeida", "Kowalski", "Diallo", "Berg",
  "Sato", "Ibrahim", "Novak", "Moreau", "Park", "Silva", "Haddad", "Walsh",
];

function wordsAt(start: number, count: number): string[] {
  return Array.from({ length: count }, (_, offset) => KEYWORD_BANK[(start + offset) % KEYWORD_BANK.length] ?? "rust");
}

export function dummyMembers(): MemberCard[] {
  const people: MemberCard[] = [];
  for (let index = 0; index < FIRST.length * LAST.length; index += 1) {
    const first = FIRST[index % FIRST.length] ?? "Amina";
    const last = LAST[Math.floor(index / FIRST.length)] ?? "Okeke";
    const [offerA, offerB, want, build, talk] = wordsAt(index * 4, 5);
    people.push({
      displayName: `${first} ${last}`,
      handle: `${first}-${last}`.toLowerCase(),
      consentIntros: true,
      offers: [offerA ?? "rust", offerB ?? "cli"],
      wants: [want ?? "ui"],
      builds: [build ?? "bots"],
      talks: [talk ?? "docs"],
      answers: {
        building: `This is ${build}.`,
        wants: `Someone with ${want}.`,
        offers: `${offerA} and ${offerB}.`,
        talk: `About ${talk}.`,
      },
    });
  }
  return people;
}

export function withCrowd(members: MemberCard[]): MemberCard[] {
  const seen = new Set(members.map((person) => person.handle));
  return [...members, ...dummyMembers().filter((person) => !seen.has(person.handle))];
}
