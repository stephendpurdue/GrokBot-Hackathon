import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { topicWords } from "../contract/match";
import type { Attempt, Evidence } from "../contract/schema";

const API = "https://api.github.com";

const Search = z.object({
  items: z.array(z.object({
    login: z.string(),
    html_url: z.string().url(),
  })),
});

const User = z.object({
  login: z.string(),
  name: z.string().nullable().optional(),
  html_url: z.string().url(),
  location: z.string().nullable().optional(),
  public_repos: z.number(),
});

type GhUser = z.infer<typeof User>;

function headers() {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "know-your-members",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function displayName(user: GhUser) {
  return user.name || user.login;
}

function toEvidence(user: GhUser, label: Evidence["label"]): Evidence {
  const location = user.location ?? "location not set";
  return {
    source: "github",
    label,
    url: user.html_url,
    text: `${displayName(user)} · ${location} · ${user.public_repos} public repos`,
  };
}

function readFixture(): GhUser[] {
  try {
    const raw = JSON.parse(readFileSync(resolve(process.cwd(), "src/fixtures/sources/community-bots.json"), "utf8")) as unknown;
    const parsed = z.object({ github: z.array(User) }).safeParse(raw);
    return parsed.success ? parsed.data.github : [];
  } catch {
    return [];
  }
}

async function searchUsers(query: string, fetchImpl: typeof fetch, signal: AbortSignal) {
  const response = await fetchImpl(`${API}/search/users?q=${encodeURIComponent(query)}&per_page=5`, {
    headers: headers(),
    signal,
  });
  if (!response.ok) throw new Error(`github ${response.status}`);
  return Search.parse(await response.json()).items;
}

async function hydrate(logins: string[], fetchImpl: typeof fetch, signal: AbortSignal) {
  const users: GhUser[] = [];
  for (const login of logins) {
    const response = await fetchImpl(`${API}/users/${encodeURIComponent(login)}`, { headers: headers(), signal });
    if (!response.ok) continue;
    const parsed = User.safeParse(await response.json());
    if (parsed.success) users.push(parsed.data);
  }
  return users;
}

export async function gatherGitHub(
  topic: string,
  memberHandles: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<{ evidence: Evidence[]; attempts: Attempt[]; names: string[] }> {
  const attempts: Attempt[] = [];
  const signal = AbortSignal.timeout(8000);
  const handles = [...new Set(memberHandles.map((handle) => handle.trim()).filter(Boolean))];

  for (const handle of handles) {
    try {
      const response = await fetchImpl(`${API}/users/${encodeURIComponent(handle)}`, { headers: headers(), signal });
      if (response.status === 404) {
        attempts.push({ runKind: "source", status: "error", subject: handle, detail: "GitHub user not found" });
      } else if (!response.ok) {
        attempts.push({
          runKind: "source",
          status: "error",
          subject: handle,
          detail: `GitHub user lookup failed (${response.status})`,
        });
      }
    } catch (error) {
      attempts.push({
        runKind: "source",
        status: "error",
        subject: handle,
        detail: error instanceof Error ? error.message : "GitHub user lookup failed",
      });
    }
  }

  try {
    const exact = await searchUsers(`${topic} location:London`, fetchImpl, signal);
    const logins: string[] = [];
    // shortcut: GitHub user search ANDs every word, so "community bots location:London" is empty; fall back to each topic word until that query starts returning people.
    if (exact.length === 0) {
      attempts.push({
        runKind: "source",
        status: "ok",
        subject: "github",
        detail: "exact query returned no users; searched topic words in London",
      });
      const seen = new Set<string>();
      const words = [...topicWords(topic)].sort((a, b) => a.length - b.length);
      for (const word of words) {
        const items = await searchUsers(`${word} location:London`, fetchImpl, signal);
        for (const item of items) {
          if (seen.has(item.login)) continue;
          seen.add(item.login);
          logins.push(item.login);
          if (logins.length >= 5) break;
        }
        if (logins.length >= 5) break;
      }
    } else {
      logins.push(...exact.map((item) => item.login));
    }
    const users = await hydrate(logins.slice(0, 5), fetchImpl, signal);
    return {
      evidence: users.map((user) => toEvidence(user, "live")),
      names: users.map(displayName),
      attempts,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "live call failed";
    const fixture = topic.trim().toLowerCase() === "community bots" ? readFixture() : [];
    if (fixture.length > 0) {
      attempts.push({
        runKind: "source",
        status: "error",
        subject: "github",
        detail: `live call failed (${message}) and the fixture was used`,
      });
      return {
        evidence: fixture.map((user) => toEvidence(user, "fixture")),
        names: fixture.map(displayName),
        attempts,
      };
    }
    attempts.push({
      runKind: "source",
      status: "error",
      subject: "github",
      detail: `live call failed (${message})`,
    });
    return { evidence: [], names: [], attempts };
  }
}
