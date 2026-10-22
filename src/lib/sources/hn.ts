import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { Attempt, Evidence } from "../contract/schema";

const Hit = z.object({
  title: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  points: z.number().nullable().optional(),
});

type Story = z.infer<typeof Hit> & { title: string; author: string };

function httpUrl(value: string | null | undefined) {
  const parsed = z.string().url().safeParse(value ?? "");
  return parsed.success ? parsed.data : null;
}

function usable(hit: z.infer<typeof Hit>): hit is Story {
  return Boolean(hit.title && hit.author);
}

function saved(topic: string): Story[] {
  if (topic.trim().toLowerCase() !== "community bots") return [];
  try {
    const raw = JSON.parse(readFileSync(resolve(process.cwd(), "src/fixtures/sources/community-bots.json"), "utf8")) as unknown;
    const parsed = z.object({ hn: z.array(Hit).optional() }).safeParse(raw);
    return parsed.success ? parsed.data.hn?.filter(usable).slice(0, 5) ?? [] : [];
  } catch {
    return [];
  }
}

function toEvidence(story: Story, label: Evidence["label"]): Evidence {
  return {
    source: "hn",
    label,
    url: httpUrl(story.url),
    text: `${story.title} · ${story.points ?? 0} points`,
  };
}

export async function gatherHn(
  topic: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ evidence: Evidence[]; attempts: Attempt[]; names: string[] }> {
  const signal = AbortSignal.timeout(8000);
  try {
    const response = await fetchImpl(
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&hitsPerPage=5`,
      { headers: { Accept: "application/json", "User-Agent": "know-your-members" }, signal },
    );
    if (!response.ok) throw new Error(`hn ${response.status}`);
    const stories = z.object({ hits: z.array(Hit) }).parse(await response.json()).hits.filter(usable).slice(0, 5);
    if (stories.length === 0) throw new Error("hn returned no stories");
    return {
      evidence: stories.map((story) => toEvidence(story, "live")),
      names: stories.map((story) => story.author),
      attempts: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "live call failed";
    const fixture = saved(topic);
    if (fixture.length > 0) {
      return {
        evidence: fixture.map((story) => toEvidence(story, "fixture")),
        names: fixture.map((story) => story.author),
        attempts: [{
          runKind: "source",
          status: "error",
          subject: "hn",
          detail: `live call failed (${message}) and the fixture was used`,
        }],
      };
    }
    return {
      evidence: [],
      names: [],
      attempts: [{ runKind: "source", status: "error", subject: "hn", detail: `live call failed (${message})` }],
    };
  }
}
