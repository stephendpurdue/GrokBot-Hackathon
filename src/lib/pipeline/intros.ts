import { pairKey, pickWeeklyPairs, scorePair, weekStart, type Profile, type ScoredPair } from "../contract/match";
import type { Attempt, IntroCard, IntroRunResult } from "../contract/schema";
import { tryDb } from "./db";
import { memory, rememberAttempts } from "./memory";
import { loadPeople, type Person } from "./people";

function draftMessage(a: string, b: string, reason: string) {
  return `${a} — ${b}. ${reason}. Want an intro this week?`.slice(0, 400);
}

function attemptsFor(members: Profile[], pairs: ScoredPair[]): Attempt[] {
  const picked = new Set(pairs.flatMap((pair) => [pair.a.id, pair.b.id]));
  const eligible = members.filter((member) => member.consentIntros);
  const ok: Attempt[] = pairs.map((pair) => ({
    runKind: "intro",
    status: "ok",
    subject: `${pair.a.displayName} — ${pair.b.displayName}`,
    detail: pair.reasons[0] ?? "introduced",
  }));
  const skipped: Attempt[] = [];
  for (const member of members) {
    if (!member.consentIntros) {
      skipped.push({ runKind: "intro", status: "skipped", subject: member.displayName, detail: "no consent" });
      continue;
    }
    if (picked.has(member.id)) continue;
    const had = eligible.some((other) => other.id !== member.id && scorePair(member, other).score >= 1);
    skipped.push({
      runKind: "intro",
      status: "skipped",
      subject: member.displayName,
      detail: had ? "best partner already introduced" : "no complement",
    });
  }
  return [...ok, ...skipped];
}

function toCards(people: Person[], pairs: ScoredPair[], week: string): IntroCard[] {
  return pairs.map((pair) => {
    const a = people.find((person) => person.id === pair.a.id);
    const b = people.find((person) => person.id === pair.b.id);
    if (!a || !b) throw new Error("pair member missing");
    return {
      weekStart: week,
      memberA: a.displayName,
      memberB: b.displayName,
      score: pair.score,
      reasons: pair.reasons,
      quotes: { a: a.wantsAnswer, b: b.wantsAnswer },
      draftMessage: draftMessage(a.displayName, b.displayName, pair.reasons[0] ?? "Worth an intro"),
    };
  });
}

function resultFor(people: Person[], pairs: ScoredPair[], week: string, fromCache: boolean): IntroRunResult {
  return {
    weekStart: week,
    fromCache,
    intros: toCards(people, pairs, week),
    attempts: attemptsFor(people, pairs),
  };
}

async function usedKeysFromDb() {
  const db = tryDb();
  if (!db) return new Set<string>();
  const { data, error } = await db.from("intros").select("member_a, member_b");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ member_a: string; member_b: string }>;
  return new Set(rows.map((row) => pairKey(row.member_a, row.member_b)));
}

async function saveWeek(people: Person[], cards: IntroCard[], attempts: Attempt[]) {
  const db = tryDb();
  if (!db) return;
  const byName = new Map(people.map((person) => [person.displayName, person]));
  const rows = cards.map((card) => {
    const a = byName.get(card.memberA);
    const b = byName.get(card.memberB);
    if (!a || !b) throw new Error("cannot save intro");
    const [memberA, memberB] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
    return {
      week_start: card.weekStart,
      member_a: memberA,
      member_b: memberB,
      score: card.score,
      reasons: card.reasons,
      draft_message: card.draftMessage,
    };
  });
  if (rows.length) {
    const { error } = await db.from("intros").insert(rows);
    if (error) throw new Error(error.message);
  }
  if (attempts.length) {
    const { error } = await db.from("attempts").insert(
      attempts.map((attempt) => ({
        run_kind: attempt.runKind,
        status: attempt.status,
        subject: attempt.subject,
        detail: attempt.detail,
      })),
    );
    if (error) throw new Error(error.message);
  }
}

export async function runIntros(asOf: string, onStep?: (step: string) => void): Promise<IntroRunResult> {
  const week = weekStart(asOf);
  onStep?.("load");
  const people = await loadPeople();
  const saved = memory.weeks.get(week);
  const db = tryDb();
  if (!db && saved) {
    onStep?.("match");
    onStep?.("draft");
    onStep?.("save");
    return { ...saved.result, fromCache: true };
  }
  if (db) {
    const existing = await getIntros(week);
    if (existing.length > 0) {
      onStep?.("match");
      onStep?.("draft");
      onStep?.("save");
      return {
        weekStart: week,
        fromCache: true,
        intros: existing,
        attempts: attemptsFor(people, peopleToPairs(people, existing)),
      };
    }
  }

  const used = db
    ? await usedKeysFromDb()
    : new Set([...memory.weeks.values()].flatMap((item) => item.keys));
  onStep?.("match");
  const pairs = pickWeeklyPairs(people, used);
  onStep?.("draft");
  const built = resultFor(people, pairs, week, false);
  onStep?.("save");
  if (db) await saveWeek(people, built.intros, built.attempts);
  else {
    memory.weeks.set(week, { result: built, keys: pairs.map((pair) => pair.key) });
    rememberAttempts(built.attempts);
  }
  return built;
}

function peopleToPairs(people: Person[], intros: IntroCard[]): ScoredPair[] {
  return intros.map((card) => {
    const a = people.find((person) => person.displayName === card.memberA);
    const b = people.find((person) => person.displayName === card.memberB);
    if (!a || !b) throw new Error("cached intro name missing");
    return { a, b, score: card.score, reasons: card.reasons, key: pairKey(a.id, b.id) };
  });
}

export async function getIntros(week: string): Promise<IntroCard[]> {
  const people = await loadPeople();
  const db = tryDb();
  if (!db) return memory.weeks.get(week)?.result.intros ?? [];
  const { data, error } = await db
    .from("intros")
    .select("week_start, member_a, member_b, score, reasons, draft_message")
    .eq("week_start", week);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    week_start: string;
    member_a: string;
    member_b: string;
    score: number;
    reasons: string[];
    draft_message: string;
  }>;
  return rows.map((row) => {
    const a = people.find((person) => person.id === row.member_a);
    const b = people.find((person) => person.id === row.member_b);
    if (!a || !b) throw new Error("intro member missing");
    const [first, second] = a.displayName < b.displayName ? [a, b] : [b, a];
    const reasons = Array.isArray(row.reasons) ? row.reasons : [];
    return {
      weekStart: String(row.week_start).slice(0, 10),
      memberA: first.displayName,
      memberB: second.displayName,
      score: row.score,
      reasons,
      quotes: { a: first.wantsAnswer, b: second.wantsAnswer },
      draftMessage: row.draft_message,
    };
  }).sort((a, b) => a.memberA.localeCompare(b.memberA) || a.memberB.localeCompare(b.memberB));
}
