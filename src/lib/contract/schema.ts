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
