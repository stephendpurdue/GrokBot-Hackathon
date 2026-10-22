"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { contactLinks, emptySession, readSession, subscribeSession, type Connection } from "@/components/session";

export default function ConnectionPage() {
  const params = useParams<{ handle: string }>();
  const handle = decodeURIComponent(typeof params.handle === "string" ? params.handle : "");
  const ready = useSyncExternalStore(subscribeSession, () => true, () => false);
  const session = useSyncExternalStore(subscribeSession, readSession, () => emptySession);
  const person = session.connections.find((item) => item.handle === handle);

  if (!ready) {
    return <main className="min-h-dvh" />;
  }

  if (!person) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-16 pb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Southbank</p>
        <h1 className="font-serif mt-4 text-5xl italic leading-none tracking-tight">No connection saved</h1>
        <p className="mt-4 text-lg leading-snug text-stone-600">Swipe right on someone and their profile stays in this browser.</p>
        <Link href="/demo" className="mt-8 rounded-full bg-stone-900 py-4 text-center text-base font-semibold text-white">
          Open the demo
        </Link>
      </main>
    );
  }

  return <Profile person={person} />;
}

function Profile({ person }: { person: Connection }) {
  const contacts = contactLinks(person.links);
  const prompts = [
    ["Building", person.building],
    ["Wants help with", person.wants ?? ""],
    ["Can offer", person.offers ?? ""],
    ["Would talk about", person.talk ?? ""],
  ] as const;
  const tags = [
    ["Offers", person.tags?.offers ?? []],
    ["Wants", person.tags?.wants ?? []],
    ["Builds", person.tags?.builds ?? []],
    ["Talks", person.tags?.talks ?? []],
  ] as const;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-16 pb-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Southbank</p>
      <h1 className="font-serif mt-4 text-5xl italic leading-none tracking-tight">{person.displayName}</h1>
      <p className="mt-2 text-stone-500">@{person.handle}</p>

      <section className="mt-8 rounded-[28px] bg-white px-5 py-5 shadow-[0_18px_50px_rgba(60,40,20,0.08)]">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c23b4a]">This connection</h2>
        {person.shared.length === 0 ? (
          <p className="mt-3 text-stone-600">No shared words were saved.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {person.shared.map((word) => (
              <li key={word} className="rounded-full bg-stone-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                {word}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-[28px] bg-white px-5 py-5 shadow-[0_18px_50px_rgba(60,40,20,0.08)]">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Contact</h2>
        {contacts.length === 0 ? (
          <p className="mt-3 text-stone-600">No contact links on file.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {contacts.map((contact) => (
              <li key={contact.href}>
                <a href={contact.href} target="_blank" rel="noreferrer" className="font-semibold text-stone-900 underline">
                  {contact.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 space-y-4 rounded-[28px] bg-white px-5 py-5 shadow-[0_18px_50px_rgba(60,40,20,0.08)]">
        {prompts.map(([label, text]) =>
          text ? (
            <div key={label}>
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{label}</h2>
              <p className="font-serif mt-1 text-xl leading-snug">{text}</p>
            </div>
          ) : null,
        )}
        <dl className="grid grid-cols-[4.25rem_1fr] gap-x-2 gap-y-2 text-sm">
          {tags.map(([label, values]) =>
            values.length === 0 ? null : (
              <div key={label} className="contents">
                <dt className="pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">{label}</dt>
                <dd className="text-stone-700">{values.join(" · ")}</dd>
              </div>
            ),
          )}
        </dl>
      </section>

      <Link href="/demo" className="mt-8 text-sm font-semibold text-stone-600">
        Back to the deck
      </Link>
    </main>
  );
}
