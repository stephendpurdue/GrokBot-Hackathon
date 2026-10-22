import { memberTopicHits } from "../contract/match";
import type { Attempt, Evidence, SpeakerPick, SpeakerResult } from "../contract/schema";
import { tryDb } from "./db";
import { memory, rememberAttempts } from "./memory";
import { loadPeople, type Person } from "./people";
import { gatherGitHub } from "../sources/github";

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
  const github = await gatherGitHub(topic, handles);
  const publicPicks: SpeakerPick[] = github.evidence.flatMap((evidence, index) => {
    const name = github.names[index];
    if (!name || evidence.text.length === 0) return [];
    return [{ name, kind: "public" as const, why: evidence.text, evidence: [evidence] }];
  });

  const picks = [...members, ...publicPicks].slice(0, 8);
  await save(topic, picks, github.attempts);
  return { topic, picks, attempts: github.attempts };
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
