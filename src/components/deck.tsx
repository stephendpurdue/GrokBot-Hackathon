"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { dummyMembers, withCrowd } from "@/components/crowd";
import { rememberConnection } from "@/components/session";
import {
  membersResponseSchema,
  queryWords,
  rankMembers,
  type MemberCard,
  type RankedMember,
} from "@/components/keywords";

const WASHES = [
  "linear-gradient(165deg, #3a2a24 0%, #c47b5d 100%)",
  "linear-gradient(165deg, #1c2c2a 0%, #6d948a 100%)",
  "linear-gradient(165deg, #2a2436 0%, #8b749f 100%)",
  "linear-gradient(165deg, #2e2418 0%, #c4a15a 100%)",
  "linear-gradient(165deg, #1b2430 0%, #7d91a8 100%)",
  "linear-gradient(165deg, #3b221f 0%, #c46b62 100%)",
];

function wash(handle: string): string {
  let total = 0;
  for (const char of handle) total += char.charCodeAt(0);
  return WASHES[total % WASHES.length] ?? WASHES[0];
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Backdrop() {
  const field = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = field.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    function onMove(event: PointerEvent) {
      if (!node) return;
      const width = window.innerWidth || 1;
      const height = window.innerHeight || 1;
      node.style.setProperty("--mx", (event.clientX / width).toFixed(4));
      node.style.setProperty("--my", (event.clientY / height).toFixed(4));
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div ref={field} className="cursor-field" aria-hidden="true">
      <span className="cursor-shape cursor-ring" />
      <span className="cursor-shape cursor-ring cursor-ring-b" />
      <span className="cursor-shape cursor-dot" />
      <span className="cursor-shape cursor-diamond" />
    </div>
  );
}

function tagHits(tag: string, shared: string[]): boolean {
  const parts = tag.toLowerCase().split(/[^a-z0-9]+/);
  return shared.some((word) => parts.includes(word.toLowerCase()));
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") return body.message;
  return fallback;
}

export function Deck({
  initialMembers = null,
  initialError = "",
}: {
  initialMembers?: MemberCard[] | null;
  initialError?: string;
} = {}) {
  const [members, setMembers] = useState<MemberCard[] | null>(() =>
    initialMembers ? withCrowd(initialMembers) : dummyMembers(),
  );
  const [loadError, setLoadError] = useState(initialError);
  const [reloadKey, setReloadKey] = useState(0);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const queryRef = useRef(query);
  queryRef.current = query;
  const [index, setIndex] = useState(0);
  const [connected, setConnected] = useState<RankedMember[]>([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (reloadKey === 0 && initialMembers) return;
    let cancel = false;
    setLoadError("");
    fetch("/api/members")
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(messageFrom(body, "Could not load people"));
        const parsed = membersResponseSchema.safeParse(body);
        if (!parsed.success) throw new Error("People came back in an unexpected shape.");
        return parsed.data.members;
      })
      .then((rows) => {
        if (!cancel && !queryRef.current) setMembers(withCrowd(rows));
      })
      .catch((error: unknown) => {
        if (cancel) return;
        if (!queryRef.current) setMembers(dummyMembers());
        setLoadError(error instanceof Error ? error.message : "Could not load people");
      });
    return () => {
      cancel = true;
    };
  }, [reloadKey, initialMembers]);

  const words = query ? queryWords(query) : [];
  const ranked = useMemo(() => (query ? rankMembers(query, members ?? []) : []), [query, members]);

  function search(event: React.FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    if (!next || !members) return;
    setQuery(next);
    setIndex(0);
    setNote("");
  }

  function edit() {
    setQuery("");
    setIndex(0);
    setNote("");
  }

  function review() {
    setIndex(0);
    setNote("");
  }

  if (!query) {
    return (
      <Ask
        draft={draft}
        setDraft={setDraft}
        onSubmit={search}
        loading={members === null && !loadError}
        error={loadError}
        onRetry={() => setReloadKey((current) => current + 1)}
      />
    );
  }

  if (words.length === 0) {
    return (
      <Notice
        title="Try a more specific word."
        body="Rust, bots, or ui will find people. Words like “working” are skipped."
        onEdit={edit}
      />
    );
  }

  if (ranked.length === 0) {
    return (
      <Notice
        title="No one shares those words."
        body={`Nothing in common with ${words.join(", ")}.`}
        onEdit={edit}
      />
    );
  }

  if (index >= ranked.length) {
    return <Done connected={connected} onEdit={edit} onReview={review} />;
  }

  return (
    <Stack
      query={query}
      ranked={ranked}
      index={index}
      note={note}
      connectedCount={connected.length}
      onEdit={edit}
      onDecide={(direction, person) => {
        if (direction === "right") {
          setConnected((current) => (current.some((item) => item.handle === person.handle) ? current : [...current, person]));
          rememberConnection({
            displayName: person.displayName,
            handle: person.handle,
            building: person.answers.building,
            shared: person.shared,
            wants: person.answers.wants,
            offers: person.answers.offers,
            talk: person.answers.talk,
            tags: {
              offers: person.offers,
              wants: person.wants,
              builds: person.builds,
              talks: person.talks,
            },
            links: person.links,
          });
          setNote(`Connected with ${person.displayName}`);
        } else {
          setNote(`Moved on from ${person.displayName}`);
        }
        setIndex((current) => current + 1);
      }}
    />
  );
}

function Ask({
  draft,
  setDraft,
  onSubmit,
  loading,
  error,
  onRetry,
}: {
  draft: string;
  setDraft: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <>
    <Backdrop />
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-16 pb-8 md:py-8">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Southbank</p>
      <form className="flex flex-1 flex-col justify-center" onSubmit={onSubmit}>
        <h1 className="font-serif text-[2.7rem] italic leading-[1.02] tracking-tight text-stone-900">
          What are you working on?
        </h1>
        <label className="mt-8 block rounded-[28px] border border-stone-200 bg-white px-5 py-5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Right now</span>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={280}
            rows={4}
            placeholder="A Rust CLI for meetup check-in"
            className="mt-3 w-full resize-none bg-transparent text-xl leading-snug text-stone-900 outline-none placeholder:text-stone-400"
          />
        </label>
        <button
          type="submit"
          disabled={loading || draft.trim().length === 0}
          className="mt-4 rounded-full bg-stone-900 py-4 text-base font-semibold text-white disabled:opacity-40"
        >
          {loading ? "Loading people…" : "Show people"}
        </button>
        {error ? (
          <p className="mt-4 text-sm text-red-800" role="alert">
            {error}{" "}
            <button type="button" className="font-semibold underline" onClick={onRetry}>
              Try again
            </button>
          </p>
        ) : null}
      </form>
      <p className="text-center text-sm text-stone-500">Swipe right to connect. Left to move on.</p>
    </main>
    </>
  );
}

function Notice({ title, body, onEdit }: { title: string; body: string; onEdit: () => void }) {
  return (
    <>
    <Backdrop />
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 pt-16 pb-8 md:py-8">
      <h1 className="font-serif text-5xl italic leading-none tracking-tight">{title}</h1>
      <p className="mt-4 text-lg text-stone-600">{body}</p>
      <button type="button" onClick={onEdit} className="mt-8 rounded-full bg-stone-900 py-4 text-base font-semibold text-white">
        Edit what you’re working on
      </button>
    </main>
    </>
  );
}

function Done({
  connected,
  onEdit,
  onReview,
}: {
  connected: RankedMember[];
  onEdit: () => void;
  onReview: () => void;
}) {
  return (
    <>
    <Backdrop />
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-16 pb-8 md:py-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Southbank</p>
      <h1 className="font-serif mt-6 text-5xl italic leading-none tracking-tight">
        {connected.length ? "You connected." : "That’s everyone."}
      </h1>
      {connected.length === 0 ? <p className="mt-4 text-lg text-stone-600">You moved on from everyone who shared those words.</p> : null}
      <ul className="mt-6 space-y-3">
        {connected.map((person) => (
          <li key={person.handle} className="rounded-[28px] border border-stone-200 bg-white px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c23b4a]">Connected</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{person.displayName}</h2>
            <p className="font-serif mt-2 text-xl leading-snug">{person.answers.building || "They didn’t say what they’re building."}</p>
            <p className="mt-3 text-sm text-stone-500">{person.shared.join(" · ")}</p>
            <Link
              href={`/connections/${encodeURIComponent(person.handle)}`}
              className="mt-4 inline-flex rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
            >
              View profile
            </Link>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onReview} className="mt-6 rounded-full bg-stone-900 py-4 text-base font-semibold text-white">
        Review again
      </button>
      <button type="button" onClick={onEdit} className="mt-3 py-2 text-sm font-semibold text-stone-600">
        Edit what you’re working on
      </button>
    </main>
    </>
  );
}

function Stack({
  query,
  ranked,
  index,
  note,
  connectedCount,
  onEdit,
  onDecide,
}: {
  query: string;
  ranked: RankedMember[];
  index: number;
  note: string;
  connectedCount: number;
  onEdit: () => void;
  onDecide: (direction: "left" | "right", person: RankedMember) => void;
}) {
  const person = ranked[index];
  const stackRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const xRef = useRef(0);
  const startX = useRef(0);
  const draggingRef = useRef(false);
  const lock = useRef(false);
  const pending = useRef<number | null>(null);
  const commitRef = useRef<(direction: "left" | "right") => void>(() => {});
  const paintRef = useRef<(nextX: number, animate: boolean) => void>(() => {});

  // Drag writes the card directly. A React render here would repaint both faces every frame.
  function paint(nextX: number, animate: boolean) {
    xRef.current = nextX;
    const card = cardRef.current;
    if (card) {
      card.style.transition = animate ? "transform 240ms ease-out" : "none";
      card.style.transform = `translate3d(${nextX}px, ${nextX * 0.04}px, 0) rotate(${nextX / 18}deg)`;
    }
    stackRef.current?.style.setProperty("--x", String(nextX));
  }

  paintRef.current = paint;

  useLayoutEffect(() => {
    lock.current = false;
    draggingRef.current = false;
    if (cardRef.current) cardRef.current.style.pointerEvents = "";
    paintRef.current(0, false);
    return () => {
      if (pending.current !== null) window.clearTimeout(pending.current);
    };
  }, [person?.handle]);

  function commit(direction: "left" | "right") {
    if (!person || lock.current) return;
    lock.current = true;
    draggingRef.current = false;
    if (cardRef.current) cardRef.current.style.pointerEvents = "none";
    paint(direction === "right" ? 560 : -560, true);
    const wait = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240;
    pending.current = window.setTimeout(() => {
      pending.current = null;
      onDecide(direction, person);
    }, wait);
  }

  commitRef.current = commit;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      commitRef.current(event.key === "ArrowLeft" ? "left" : "right");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!person) return null;

  return (
    <>
    <Backdrop />
    <main ref={stackRef} className="relative z-10 mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden px-4 pt-14 pb-4 md:py-4 [--x:0]">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Southbank</p>
          <p className="truncate text-sm text-stone-700">“{query}”</p>
          <p className="text-xs text-stone-500">
            {index + 1} of {ranked.length}
            {connectedCount ? ` · ${connectedCount} connected` : ""}
          </p>
        </div>
        <button type="button" onClick={onEdit} className="shrink-0 text-sm font-semibold text-stone-800">
          Edit
        </button>
      </header>

      <div className="relative mt-3 min-h-0 flex-1">
        <div
          key={person.handle}
          ref={cardRef}
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={(event) => {
            if (lock.current) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            startX.current = event.clientX;
            draggingRef.current = true;
            paint(xRef.current, false);
          }}
          onPointerMove={(event) => {
            if (!draggingRef.current || lock.current) return;
            paint(event.clientX - startX.current, false);
          }}
          onPointerUp={() => {
            if (!draggingRef.current || lock.current) return;
            draggingRef.current = false;
            const current = xRef.current;
            if (current > 96) commit("right");
            else if (current < -96) commit("left");
            else paint(0, true);
          }}
          onPointerCancel={() => {
            if (lock.current) return;
            draggingRef.current = false;
            paint(0, true);
          }}
        >
          <PersonFace person={person} />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-5 top-8 rounded-md border-[3px] border-[#c23b4a] px-2 py-1 text-2xl font-semibold tracking-wide text-[#c23b4a]"
            style={{ opacity: "min(1, max(0, calc(var(--x) / 90)))", transform: "rotate(-16deg)" }}
          >
            CONNECT
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-5 top-8 rounded-md border-[3px] border-stone-500 px-2 py-1 text-2xl font-semibold tracking-wide text-stone-500"
            style={{ opacity: "min(1, max(0, calc(var(--x) * -1 / 90)))", transform: "rotate(16deg)" }}
          >
            NEXT
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-8 pt-4">
        <button
          type="button"
          aria-label="Move on"
          onClick={() => commit("left")}
          className="grid h-16 w-16 place-items-center rounded-full bg-white text-stone-800 shadow-[0_8px_24px_rgba(60,40,20,0.12)]"
          style={{ scale: "calc(1 + min(0.18, max(0, calc(var(--x) * -1)) / 500))" }}
        >
          <XIcon />
        </button>
        <button
          type="button"
          aria-label="Connect"
          onClick={() => commit("right")}
          className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-stone-900 text-white shadow-[0_10px_24px_rgba(28,25,23,0.28)]"
          style={{ scale: "calc(1 + min(0.18, max(0, var(--x)) / 500))" }}
        >
          <HeartIcon />
        </button>
      </div>
      <p className="h-6 pt-2 text-center text-sm text-stone-500" aria-live="polite">
        {note || "Swipe the card, or use the buttons"}
      </p>
    </main>
    </>
  );
}

function PersonFace({ person }: { person: RankedMember }) {
  const prompts = [
    ["I’m building", person.answers.building.trim(), true],
    ["I want help with", person.answers.wants.trim(), false],
    ["I can offer", person.answers.offers.trim(), false],
    ["I’d talk about", person.answers.talk.trim(), false],
  ] as const;
  const groups = [
    ["Offers", person.offers],
    ["Wants", person.wants],
    ["Builds", person.builds],
    ["Talks", person.talks],
  ] as const;
  const project = person.builds[0];
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-white">
      <div className="relative min-h-40 flex-1" style={{ background: wash(person.handle) }}>
        <p className="font-serif absolute inset-0 flex items-center justify-center text-7xl text-white/25" aria-hidden="true">
          {initials(person.displayName)}
        </p>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 pb-4 pt-16 text-white">
          <h2 className="text-3xl font-semibold tracking-tight">{person.displayName}</h2>
          <p className="text-sm text-white/80">@{person.handle}{project ? ` · ${project}` : ""}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
            {person.shared.length} {person.shared.length === 1 ? "word" : "words"} in common
          </p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {prompts.map(([label, text, lead]) => {
          if (!lead && !text) return null;
          return (
            <div key={label}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{label}</p>
              <p className={lead ? "font-serif mt-1 text-[1.35rem] leading-snug tracking-tight text-stone-900" : "font-serif mt-1 text-lg leading-snug text-stone-800"}>
                {text || "They didn’t say what they’re building."}
              </p>
            </div>
          );
        })}
        <ul className="flex flex-wrap gap-2">
          {person.shared.map((word) => (
            <li key={word} className="rounded-full bg-stone-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
              {word}
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-[4.25rem_1fr] gap-x-2 gap-y-2 text-sm">
          {groups.map(([label, tags]) => tags.length === 0 ? null : (
            <div key={label} className="contents">
              <dt className="pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">{label}</dt>
              <dd>
                <ul className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <li
                      key={tag}
                      className={tagHits(tag, person.shared) ? "rounded-full bg-stone-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white" : "rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-600"}
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

function HeartIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
