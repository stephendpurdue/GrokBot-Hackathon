import { z } from "zod";
import { memberTopicHits } from "../contract/match";
import type { Attempt, Evidence, SpeakerPick, SpeakerResult } from "../contract/schema";
import { chatJSON } from "../llm/client";
import { tryDb } from "./db";
import { memory, rememberAttempts } from "./memory";
import { loadPeople, type Person } from "./people";
import { gatherDevpost } from "../sources/devpost";
import { gatherGitHub } from "../sources/github";
import { gatherHn } from "../sources/hn";
import { gatherLuma } from "../sources/luma";

const Whys = z.object({
  whys: z.array(z.object({
    name: z.string(),
    why: z.string().min(1).max(400),
  })),
});

function toPublic(gathered: { evidence: Evidence[]; names: string[] }): SpeakerPick[] {
  return gathered.evidence.flatMap((evidence, index) => {
    const name = gathered.names[index];
    if (!name || evidence.text.length === 0) return [];
    return [{ name, kind: "public" as const, why: evidence.text, evidence: [evidence] }];
  });
}

async function applyWhys(topic: string, picks: SpeakerPick[]): Promise<SpeakerPick[]> {
  if (!process.env.LLM_API_KEY || !process.env.LLM_MODEL || picks.length === 0) return picks;
  try {
    const result = await chatJSON({
      schema: Whys,
      system: `Write one sentence per person explaining why they fit the topic.
Use only the evidence text. If the evidence does not support a claim, say what the
evidence actually is. Return ONLY JSON: { "whys": [{ "name": "...", "why": "..." }] }`,
      user: JSON.stringify({
        topic,
        people: picks.map((pick) => ({ name: pick.name, evidence: pick.evidence.map((item) => item.text) })),
      }),
    });
    const byName = new Map(result.whys.map((item) => [item.name, item.why]));
    return picks.map((pick) => {
      const why = byName.get(pick.name)?.trim();
      return why ? { ...pick, why: why.slice(0, 400) } : pick;
    });
  } catch {
    return picks;
  }
}

function memberPick(person: Person): SpeakerPick {
  const text = person.talkAnswer || person.buildingAnswer;
  const evidence: Evidence[] = [{ source: "answers", label: "live", url: null, text }];
  return { name: person.displayName, kind: "member", why: text, evidence };
}

async function save(topic: string, picks: SpeakerPick[], attempts: Attempt[]) {
  const db = tryDb();
  if (!db) {
    rememberAttempts(attempts);
    return;
  }
  const { data, error } = await db.from("speaker_runs").insert({ topic }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "speaker run missing");
  if (picks.length) {
    const { error: pickError } = await db.from("speaker_picks").insert(
      picks.map((pick) => ({
        run_id: data.id,
        name: pick.name,
        kind: pick.kind,
        why: pick.why,
        evidence: pick.evidence,
      })),
    );
    if (pickError) throw new Error(pickError.message);
  }
  if (attempts.length) {
    const { error: attemptError } = await db.from("attempts").insert(
      attempts.map((attempt) => ({
        run_kind: attempt.runKind,
        status: attempt.status,
        subject: attempt.subject,
        detail: attempt.detail,
      })),
    );
    if (attemptError) throw new Error(attemptError.message);
  }
}

export async function findSpeakers(topic: string): Promise<SpeakerResult> {
  const people = await loadPeople();
  const members = people
    .filter((person) => person.consentIntros)
    .map((person) => ({ person, hits: memberTopicHits(person, topic) }))
    .filter((row) => row.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length || a.person.displayName.localeCompare(b.person.displayName))
    .slice(0, 4)
    .filter((row) => (row.person.talkAnswer || row.person.buildingAnswer).length > 0)
    .map((row) => memberPick(row.person));

  const handles = people.flatMap((person) => (person.links.github ? [person.links.github] : []));
  const settled = await Promise.allSettled([
    gatherGitHub(topic, handles),
    gatherDevpost(topic),
    gatherHn(topic),
    gatherLuma(topic),
  ]);
  const sourceNames = ["github", "devpost", "hn", "luma"] as const;
  const attempts: Attempt[] = [];
  const publicPicks: SpeakerPick[] = [];
  settled.forEach((result, index) => {
    if (result.status === "rejected") {
      const message = result.reason instanceof Error ? result.reason.message : "source failed";
      attempts.push({ runKind: "source", status: "error", subject: sourceNames[index], detail: message });
      return;
    }
    attempts.push(...result.value.attempts);
    publicPicks.push(...toPublic(result.value));
  });

  const picks = await applyWhys(topic, [...members, ...publicPicks].slice(0, 8));
  await save(topic, picks, attempts);
  return { topic, picks, attempts };
}

export async function listAttempts() {
  const db = tryDb();
  if (!db) return memory.attempts.slice(0, 50);
  const { data, error } = await db
    .from("attempts")
    .select("run_kind, status, subject, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    run_kind: Attempt["runKind"];
    status: Attempt["status"];
    subject: string;
    detail: string;
    created_at: string;
  }>;
  return rows.map((row) => ({
    runKind: row.run_kind,
    status: row.status,
    subject: row.subject,
    detail: row.detail,
    createdAt: row.created_at,
  }));
}
