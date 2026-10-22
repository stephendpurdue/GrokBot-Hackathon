import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { topicWords } from "../contract/match";
import type { Attempt, Evidence } from "../contract/schema";

const Host = z.object({
  name: z.string().min(1),
  website: z.string().nullable().optional(),
});

const Payload = z.object({
  event: z.object({
    name: z.string(),
    url: z.string().optional(),
  }),
  hosts: z.array(Host).optional().default([]),
  description_mirror: z.unknown().optional(),
});

type HostPick = { name: string; text: string; url: string };

function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  if (value && typeof value === "object") return Object.values(value).map(textOf).join(" ");
  return "";
}

function httpUrl(value: string | null | undefined) {
  const parsed = z.string().url().safeParse(value ?? "");
  return parsed.success ? parsed.data : null;
}

function eventLink(url: string | undefined, eventId: string) {
  if (url && /^https?:\/\//.test(url)) return url;
  if (url?.trim()) return `https://lu.ma/${url.replace(/^\//, "")}`;
  return `https://lu.ma/${eventId}`;
}

function saved(topic: string): HostPick[] {
  if (topic.trim().toLowerCase() !== "community bots") return [];
  try {
    const raw = JSON.parse(readFileSync(resolve(process.cwd(), "src/fixtures/sources/community-bots.json"), "utf8")) as unknown;
    const parsed = z.object({
      luma: z.array(z.object({ name: z.string().min(1), text: z.string().min(1), url: z.string().url() })).optional(),
    }).safeParse(raw);
    return parsed.success ? parsed.data.luma ?? [] : [];
  } catch {
    return [];
  }
}

export async function gatherLuma(
  topic: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ evidence: Evidence[]; attempts: Attempt[]; names: string[] }> {
  const signal = AbortSignal.timeout(8000);
  const ids = (process.env.LUMA_EVENT_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  const words = topicWords(topic);
  const picks: HostPick[] = [];
  const attempts: Attempt[] = [];

  try {
    for (const id of ids) {
      const response = await fetchImpl(
        `https://api.lu.ma/event/get?event_api_id=${encodeURIComponent(id)}`,
        { headers: { Accept: "application/json", "User-Agent": "know-your-members" }, signal },
      );
      if (!response.ok) throw new Error(`luma ${response.status}`);
      const payload = Payload.parse(await response.json());
      const blob = `${payload.event.name} ${textOf(payload.description_mirror)}`.toLowerCase();
      if (!words.some((word) => blob.includes(word))) continue;
      for (const host of payload.hosts) {
        picks.push({
          name: host.name,
          text: `${payload.event.name} · ${host.name}`,
          url: httpUrl(host.website) ?? eventLink(payload.event.url, id),
        });
      }
    }
    if (picks.length === 0) throw new Error("no host matched topic");
    return {
      evidence: picks.map((pick) => ({ source: "luma", label: "live", url: pick.url, text: pick.text })),
      names: picks.map((pick) => pick.name),
      attempts,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "live call failed";
    if (message === "no host matched topic") {
      return {
        evidence: [],
        names: [],
        attempts: [{ runKind: "source", status: "skipped", subject: "luma", detail: "no host matched topic" }],
      };
    }
    const fixture = saved(topic);
    if (fixture.length > 0) {
      return {
        evidence: fixture.map((pick) => ({ source: "luma", label: "fixture", url: pick.url, text: pick.text })),
        names: fixture.map((pick) => pick.name),
        attempts: [{
          runKind: "source",
          status: "error",
          subject: "luma",
          detail: `live call failed (${message}) and the fixture was used`,
        }],
      };
    }
    return {
      evidence: [],
      names: [],
      attempts: [{ runKind: "source", status: "error", subject: "luma", detail: `live call failed (${message})` }],
    };
  }
}
