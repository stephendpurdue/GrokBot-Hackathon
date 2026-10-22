import { z } from "zod";
import { linksSchema } from "@/components/keywords";

export const connectionSchema = z.object({
  displayName: z.string(),
  handle: z.string(),
  building: z.string(),
  shared: z.array(z.string()),
  wants: z.string().optional(),
  offers: z.string().optional(),
  talk: z.string().optional(),
  tags: z
    .object({
      offers: z.array(z.string()),
      wants: z.array(z.string()),
      builds: z.array(z.string()),
      talks: z.array(z.string()),
    })
    .optional(),
  links: linksSchema.optional(),
});

export type Connection = z.infer<typeof connectionSchema>;

export type Session = {
  connections: Connection[];
  name: string;
};

export const emptySession: Session = { connections: [], name: "" };

const CONNECTIONS_KEY = "southbank.connections";
const NAME_KEY = "southbank.name";

export function parseConnections(raw: string | null): Connection[] {
  if (!raw) return [];
  try {
    const parsed = z.array(connectionSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

let snapshot: Session = emptySession;
let ready = false;

const listeners = new Set<() => void>();

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) listener();
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSession(): Session {
  if (typeof window === "undefined") return emptySession;
  if (ready) return snapshot;
  const store = storage();
  snapshot = {
    connections: parseConnections(store?.getItem(CONNECTIONS_KEY) ?? null),
    name: store?.getItem(NAME_KEY)?.trim() ?? "",
  };
  ready = true;
  return snapshot;
}

function persist(next: Session): void {
  const store = storage();
  if (!store) return;
  store.setItem(CONNECTIONS_KEY, JSON.stringify(next.connections));
  if (next.name) store.setItem(NAME_KEY, next.name);
  else store.removeItem(NAME_KEY);
  snapshot = next;
  ready = true;
  emit();
}

const CONTACT_LABEL = { github: "GitHub", devpost: "Devpost", hn: "Hacker News", site: "Site" } as const;

function contactHref(kind: keyof typeof CONTACT_LABEL, value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return url.href;
    } catch {
      return null;
    }
  }
  if (kind === "site" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,38}$/.test(trimmed)) return null;
  const slug = encodeURIComponent(trimmed);
  if (kind === "github") return `https://github.com/${slug}`;
  if (kind === "devpost") return `https://devpost.com/${slug}`;
  return `https://news.ycombinator.com/user?id=${slug}`;
}

export function contactLinks(links: Connection["links"]): { label: string; href: string }[] {
  if (!links) return [];
  const rows: { label: string; href: string }[] = [];
  for (const kind of ["github", "devpost", "hn", "site"] as const) {
    const href = contactHref(kind, links[kind]);
    if (href) rows.push({ label: CONTACT_LABEL[kind], href });
  }
  return rows;
}

export function rememberConnection(person: Connection): void {
  if (typeof window === "undefined") return;
  const current = readSession();
  const index = current.connections.findIndex((item) => item.handle === person.handle);
  if (index === -1) {
    persist({ ...current, connections: [person, ...current.connections] });
    return;
  }
  const connections = current.connections.slice();
  connections[index] = person;
  persist({ ...current, connections });
}

export function clearConnections(): void {
  if (typeof window === "undefined") return;
  persist({ ...readSession(), connections: [] });
}

export function saveAccountName(name: string): void {
  if (typeof window === "undefined") return;
  persist({ ...readSession(), name: name.trim() });
}
