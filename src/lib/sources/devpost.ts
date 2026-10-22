import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { Attempt, Evidence } from "../contract/schema";

const Item = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  tagline: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
});

type Project = z.infer<typeof Item>;

function saved(topic: string): Project[] {
  if (topic.trim().toLowerCase() !== "community bots") return [];
  try {
    const raw = JSON.parse(readFileSync(resolve(process.cwd(), "src/fixtures/sources/community-bots.json"), "utf8")) as unknown;
    const parsed = z.object({ devpost: z.array(Item).optional() }).safeParse(raw);
    return parsed.success ? (parsed.data.devpost ?? []).slice(0, 5) : [];
  } catch {
    return [];
  }
}

function toEvidence(project: Project, label: Evidence["label"]): Evidence {
  const tags = project.tags.slice(0, 8).join(", ");
  const text = [project.tagline, tags].filter(Boolean).join(" · ") || project.name;
  return { source: "devpost", label, url: project.url, text };
}

export async function gatherDevpost(
  topic: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ evidence: Evidence[]; attempts: Attempt[]; names: string[] }> {
  const signal = AbortSignal.timeout(8000);
  try {
    const response = await fetchImpl(
      `https://devpost.com/software/search?query=${encodeURIComponent(topic)}`,
      { headers: { Accept: "application/json", "User-Agent": "know-your-members" }, signal },
    );
    if (!response.ok) throw new Error(`devpost ${response.status}`);
    const projects = z.object({ software: z.array(Item) }).parse(await response.json()).software.slice(0, 5);
    if (projects.length === 0) throw new Error("devpost returned no projects");
    return {
      evidence: projects.map((project) => toEvidence(project, "live")),
      names: projects.map((project) => project.name),
      attempts: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "live call failed";
    const fixture = saved(topic);
    if (fixture.length > 0) {
      return {
        evidence: fixture.map((project) => toEvidence(project, "fixture")),
        names: fixture.map((project) => project.name),
        attempts: [{
          runKind: "source",
          status: "error",
          subject: "devpost",
          detail: `live call failed (${message}) and the fixture was used`,
        }],
      };
    }
    return {
      evidence: [],
      names: [],
      attempts: [{ runKind: "source", status: "error", subject: "devpost", detail: `live call failed (${message})` }],
    };
  }
}
