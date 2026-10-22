"use client";

import { useEffect, useState } from "react";
import type { Attempt, IntroRunResult, SpeakerResult } from "@/lib/contract/schema";
import demo from "@/fixtures/demo.json";
import seed from "../../data/seed.json";

const QUESTIONS = [
  ["building", "What are you building?"],
  ["wants", "What do you want help with?"],
  ["offers", "What can you help others with?"],
  ["talk", "What would you talk about for 10 minutes?"],
] as const;

const QUESTIONNAIRE = `Four questions, reply only if you want to be introduced.
1. What are you building?
2. What do you want help with?
3. What can you help others with?
4. What would you talk about for 10 minutes?
No reply means you are not matched.`;

const STEPS = ["load", "match", "draft", "save"] as const;

type Member = {
  displayName: string;
  handle: string;
  consentIntros: boolean;
  offers: string[];
  wants: string[];
  builds: string[];
  talks: string[];
  answers: { building: string; wants: string; offers: string; talk: string };
  links: { github?: string };
};

type StepState = { status: "wait" | "run" | "ok"; ms?: number };

const seedMembers: Member[] = seed.members.map((member) => ({
  displayName: member.displayName,
  handle: member.handle,
  consentIntros: member.consentIntros,
  offers: member.offers,
  wants: member.wants,
  builds: member.builds,
  talks: member.talks,
  answers: member.answers,
  links: member.links,
}));

function dedupe(attempts: Attempt[]) {
  const seen = new Set<string>();
  return attempts.filter((attempt) => {
    const key = `${attempt.runKind}|${attempt.status}|${attempt.subject}|${attempt.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function LeadView({ fixtureMode }: { fixtureMode: boolean }) {
  const [members, setMembers] = useState<Member[] | null>(fixtureMode ? seedMembers : null);
  const [membersError, setMembersError] = useState("");
  const [weekOne, setWeekOne] = useState<IntroRunResult | null>(fixtureMode ? (demo.weekOne as IntroRunResult) : null);
  const [weekTwo, setWeekTwo] = useState<IntroRunResult | null>(fixtureMode ? (demo.weekTwo as IntroRunResult) : null);
  const [steps, setSteps] = useState<Record<string, StepState>>(
    fixtureMode ? Object.fromEntries(STEPS.map((step) => [step, { status: "ok" }])) : {},
  );
  const [running, setRunning] = useState<"week" | "later" | null>(null);
  const [introError, setIntroError] = useState("");
  const [topic, setTopic] = useState(fixtureMode ? demo.speakers.topic : "community bots");
  const [speakers, setSpeakers] = useState<SpeakerResult | null>(fixtureMode ? (demo.speakers as SpeakerResult) : null);
  const [speakerError, setSpeakerError] = useState("");
  const [speakerLoading, setSpeakerLoading] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>(
    fixtureMode ? dedupe([...demo.weekOne.attempts, ...demo.weekTwo.attempts, ...demo.speakers.attempts] as Attempt[]) : [],
  );
  const [logError, setLogError] = useState("");
  const [logLoading, setLogLoading] = useState(!fixtureMode);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (fixtureMode) return;
    let cancel = false;
    fetch("/api/members")
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json() as Promise<{ members: Member[] }>;
      })
      .then((data) => {
        if (!cancel) setMembers(data.members);
      })
      .catch((error: unknown) => {
        if (!cancel) setMembersError(error instanceof Error ? error.message : "Could not load members");
      });
    fetch("/api/attempts")
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json() as Promise<{ attempts: Attempt[] }>;
      })
      .then((data) => {
        if (!cancel) setAttempts((current) => dedupe([...data.attempts, ...current]));
      })
      .catch((error: unknown) => {
        if (!cancel) setLogError(error instanceof Error ? error.message : "Could not load the log");
      })
      .finally(() => {
        if (!cancel) setLogLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [fixtureMode]);

  async function runWeek(asOf: string, which: "week" | "later") {
    setRunning(which);
    setIntroError("");
    setSteps(Object.fromEntries(STEPS.map((step) => [step, { status: "wait" }])));
    try {
      const response = await fetch("/api/intros/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asOf }),
      });
      if (!response.ok || !response.body) {
        setIntroError(await response.text());
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const message = JSON.parse(line) as {
            step: string;
            status: string;
            ms?: number;
            data?: IntroRunResult | { message: string };
          };
          if (message.step === "error") {
            const data = message.data as { message?: string } | undefined;
            setIntroError(data?.message ?? "Intro run failed");
            continue;
          }
          if (STEPS.includes(message.step as (typeof STEPS)[number])) {
            setSteps((current) => ({ ...current, [message.step]: { status: "ok", ms: message.ms } }));
          }
          if (message.step === "done" && message.data && "intros" in message.data) {
            const result = message.data;
            if (which === "week") setWeekOne(result);
            else setWeekTwo(result);
            setAttempts((current) => dedupe([...result.attempts, ...current]));
          }
        }
      }
    } catch (error) {
      setIntroError(error instanceof Error ? error.message : "Intro run failed");
    } finally {
      setRunning(null);
    }
  }

  async function find() {
    setSpeakerLoading(true);
    setSpeakerError("");
    try {
      const response = await fetch("/api/speakers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const text = await response.text();
      if (!response.ok) {
        setSpeakerError(text);
        return;
      }
      const result = JSON.parse(text) as SpeakerResult;
      setSpeakers(result);
      setAttempts((current) => dedupe([...result.attempts, ...current]));
    } catch (error) {
      setSpeakerError(error instanceof Error ? error.message : "Speaker search failed");
    } finally {
      setSpeakerLoading(false);
    }
  }

  async function copy(id: string, text: string) {
    try {
      await copyText(text);
      setCopied(id);
    } catch (error) {
      setIntroError(error instanceof Error ? error.message : "Copy failed");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-white px-4 py-8 text-neutral-900 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">Southbank Builders</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Know your members</h1>
      <p className="mt-2 text-lg text-neutral-700">One introduction a week, with a reason. Then a shortlist that cites proof.</p>
      {fixtureMode ? <p className="mt-2 text-sm text-amber-800">Fixture mode. The API is not called.</p> : null}

      <section className="mt-8" aria-labelledby="questionnaire">
        <h2 id="questionnaire" className="text-xl font-semibold">Questionnaire</h2>
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">{QUESTIONNAIRE}</pre>
        <button className="mt-3 rounded-md bg-neutral-900 px-3 py-2 text-sm text-white" type="button" onClick={() => copy("questions", QUESTIONNAIRE)}>
          {copied === "questions" ? "Copied" : "Copy questions"}
        </button>
      </section>

      <section className="mt-10" aria-labelledby="members">
        <h2 id="members" className="text-xl font-semibold">Members</h2>
        {membersError ? <p className="mt-3 text-red-700" role="alert">{membersError}</p> : null}
        {!members && !membersError ? <p className="mt-3 text-neutral-600">Loading members…</p> : null}
        {members && members.length === 0 ? <p className="mt-3 text-neutral-600">No members yet.</p> : null}
        <ul className="mt-4 space-y-4">
          {(members ?? []).map((member) => (
            <li key={member.handle} className="rounded-lg border border-neutral-200 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold">{member.displayName}</h3>
                <span className={member.consentIntros ? "text-sm text-green-800" : "text-sm font-semibold text-red-800"}>
                  {member.consentIntros ? "opted in" : "no intros"}
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-500">@{member.handle}</p>
              <dl className="mt-3 space-y-1 text-sm">
                {(["offers", "wants", "builds", "talks"] as const).map((key) => (
                  <div key={key} className="flex flex-wrap gap-2">
                    <dt className="w-16 capitalize text-neutral-500">{key}</dt>
                    <dd>{member[key].length ? member[key].join(", ") : "none"}</dd>
                  </div>
                ))}
              </dl>
              <dl className="mt-3 space-y-2 text-sm">
                {QUESTIONS.map(([key, label]) => (
                  <div key={key}>
                    <dt className="text-neutral-500">{label}</dt>
                    <dd>{member.answers[key] || "—"}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="this-week">
        <h2 id="this-week" className="text-xl font-semibold">This week</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50" type="button" disabled={fixtureMode || running !== null} onClick={() => runWeek("2026-10-22", "week")}>
            {running === "week" ? "Running…" : "Run this week"}
          </button>
          <button className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50" type="button" disabled={fixtureMode || running !== null} onClick={() => runWeek("2026-11-21", "later")}>
            {running === "later" ? "Running…" : "Run a month later"}
          </button>
        </div>
        <ol className="mt-4 space-y-1 text-sm" aria-live="polite">
          {STEPS.map((step) => {
            const state = steps[step];
            return (
              <li key={step}>
                {state?.status === "ok" ? "✓" : running ? "…" : "·"} {step}
                {typeof state?.ms === "number" ? ` ${state.ms}ms` : ""}
              </li>
            );
          })}
        </ol>
        {introError ? <p className="mt-3 text-red-700" role="alert">{introError}</p> : null}
        <WeekBlock title="Week of 19 Oct" run={weekOne} copied={copied} onCopy={copy} />
        <WeekBlock title="A month later" run={weekTwo} copied={copied} onCopy={copy} />
      </section>

      <section className="mt-10" aria-labelledby="speakers">
        <h2 id="speakers" className="text-xl font-semibold">Speakers</h2>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); if (!fixtureMode) void find(); }}>
          <label className="sr-only" htmlFor="topic">Topic</label>
          <input id="topic" className="w-full rounded-md border border-neutral-300 px-3 py-2" value={topic} onChange={(event) => setTopic(event.target.value)} />
          <button className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50" type="submit" disabled={fixtureMode || speakerLoading}>
            {speakerLoading ? "Searching…" : "Find speakers"}
          </button>
        </form>
        {speakerError ? <p className="mt-3 text-red-700" role="alert">{speakerError}</p> : null}
        {!speakers && !speakerError ? <p className="mt-3 text-neutral-600">No shortlist yet.</p> : null}
        <ul className="mt-4 space-y-4">
          {(speakers?.picks ?? []).filter((pick) => pick.evidence.length > 0 && pick.why).map((pick) => (
            <li key={`${pick.kind}-${pick.name}`} className="rounded-lg border border-neutral-200 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold">{pick.name}</h3>
                <span className="text-sm text-neutral-500">{pick.kind}</span>
              </div>
              <p className="mt-2">{pick.why}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {pick.evidence.map((item, index) => (
                  <li key={`${item.source}-${index}`}>
                    <span className="font-medium">{item.source}</span> · {item.label}
                    <p>{item.text}</p>
                    {item.url ? <a className="underline" href={item.url}>{item.url}</a> : null}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 mb-16" aria-labelledby="log">
        <h2 id="log" className="text-xl font-semibold">Log</h2>
        {logLoading ? <p className="mt-3 text-neutral-600">Loading the log…</p> : null}
        {logError ? <p className="mt-3 text-red-700" role="alert">{logError}</p> : null}
        {!logLoading && attempts.length === 0 ? <p className="mt-3 text-neutral-600">No attempts yet.</p> : null}
        <ul className="mt-4 space-y-2 text-sm">
          {attempts.map((attempt) => (
            <li key={`${attempt.runKind}-${attempt.status}-${attempt.subject}-${attempt.detail}`} className="rounded-md border border-neutral-200 px-3 py-2">
              <span className={attempt.status === "error" ? "font-semibold text-red-800" : attempt.status === "skipped" ? "font-semibold text-amber-800" : "font-semibold text-green-800"}>
                {attempt.status}
              </span>
              {" "}{attempt.runKind} · {attempt.subject}
              <p>{attempt.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function WeekBlock({
  title,
  run,
  copied,
  onCopy,
}: {
  title: string;
  run: IntroRunResult | null;
  copied: string;
  onCopy: (id: string, text: string) => void;
}) {
  if (!run) return null;
  const cards = run.intros.filter((card) => card.reasons.length > 0 && card.quotes.a && card.quotes.b);
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      {run.fromCache ? <p className="mt-1 text-sm font-medium text-amber-800">Already ran this week</p> : null}
      {cards.length === 0 ? <p className="mt-2 text-neutral-600">No introductions.</p> : null}
      <ul className="mt-3 space-y-4">
        {cards.map((card) => {
          const id = `${card.weekStart}-${card.memberA}-${card.memberB}`;
          return (
            <li key={id} className="rounded-lg border border-neutral-200 p-4">
              <h4 className="text-lg font-semibold">{card.memberA} — {card.memberB}</h4>
              <p className="text-sm text-neutral-500">Score {card.score}</p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {card.reasons.map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              <blockquote className="mt-3 border-l-2 border-neutral-300 pl-3 text-sm">
                <p>{card.memberA}: {card.quotes.a}</p>
                <p className="mt-1">{card.memberB}: {card.quotes.b}</p>
              </blockquote>
              <p className="mt-3 text-sm">{card.draftMessage}</p>
              <button className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm" type="button" onClick={() => onCopy(id, card.draftMessage)}>
                {copied === id ? "Copied" : "Copy"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
