import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { ReviveResult } from "../contract/schema";
import { chatJSON } from "../llm/client";
import { tryDb } from "./db";
import { rememberAttempts } from "./memory";

export type ThreadMessage = { threadId: string; content: string; createdAt: string };

const Nudges = z.object({
  nudges: z.array(z.object({
    threadId: z.string(),
    message: z.string().min(1).max(400),
  })),
});

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function decideRevives(messages: ThreadMessage[], today: string): ReviveResult {
  const cutoff = addDays(today, -14);
  const groups = new Map<string, ThreadMessage[]>();
  for (const message of messages) {
    const rows = groups.get(message.threadId) ?? [];
    rows.push(message);
    groups.set(message.threadId, rows);
  }

  const result: ReviveResult = { revives: [], attempts: [] };
  for (const [threadId, rows] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ordered = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = ordered[ordered.length - 1]?.createdAt.slice(0, 10) ?? "";
    const opening = ordered[0]?.content ?? "";
    if (last > cutoff) {
      result.attempts.push({ runKind: "thread", status: "skipped", subject: threadId, detail: "still active" });
      continue;
    }
    if (ordered.length < 3) {
      result.attempts.push({ runKind: "thread", status: "skipped", subject: threadId, detail: "too thin" });
      continue;
    }
    result.revives.push({
      threadId,
      quote: opening,
      draftMessage: `Picking "${threadId}" back up — "${opening}". Still worth it?`.slice(0, 400),
    });
    result.attempts.push({ runKind: "thread", status: "ok", subject: threadId, detail: opening });
  }
  return result;
}

async function loadMessages(): Promise<ThreadMessage[]> {
  const db = tryDb();
  if (!db) {
    const seed = JSON.parse(readFileSync(resolve(process.cwd(), "data/seed.json"), "utf8")) as {
      messages: ThreadMessage[];
    };
    return seed.messages;
  }
  const { data, error } = await db.from("messages").select("thread_id, content, created_at");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ thread_id: string; content: string; created_at: string }>;
  return rows.map((row) => ({ threadId: row.thread_id, content: row.content, createdAt: row.created_at }));
}

async function polish(result: ReviveResult): Promise<ReviveResult> {
  if (!process.env.LLM_API_KEY || !process.env.LLM_MODEL || result.revives.length === 0) return result;
  try {
    const data = await chatJSON({
      schema: Nudges,
      system: `Rewrite each nudge in under 280 characters. The opening sentence must appear verbatim.
Do not add events or people. Return ONLY JSON: { "nudges": [{ "threadId": "...", "message": "..." }] }`,
      user: JSON.stringify(result.revives),
    });
    const byThread = new Map(data.nudges.map((nudge) => [nudge.threadId, nudge.message]));
    return {
      ...result,
      revives: result.revives.map((revive) => {
        const message = byThread.get(revive.threadId)?.trim();
        if (!message || !message.includes(revive.quote)) return revive;
        return { ...revive, draftMessage: message.slice(0, 400) };
      }),
    };
  } catch {
    return result;
  }
}

async function persist(result: ReviveResult) {
  const db = tryDb();
  if (!db) {
    rememberAttempts(result.attempts);
    return;
  }
  if (result.revives.length) {
    const { error } = await db.from("revives").insert(
      result.revives.map((revive) => ({ thread_id: revive.threadId, draft_message: revive.draftMessage })),
    );
    if (error) throw new Error(error.message);
  }
  if (result.attempts.length) {
    const { error } = await db.from("attempts").insert(
      result.attempts.map((attempt) => ({
        run_kind: attempt.runKind,
        status: attempt.status,
        subject: attempt.subject,
        detail: attempt.detail,
      })),
    );
    if (error) throw new Error(error.message);
  }
}

export async function reviveThreads(today = "2026-10-22"): Promise<ReviveResult> {
  const result = await polish(decideRevives(await loadMessages(), today));
  await persist(result);
  return result;
}
