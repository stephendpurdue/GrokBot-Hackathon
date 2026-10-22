"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { clearConnections, emptySession, readSession, subscribeSession } from "@/components/session";

export default function SettingsPage() {
  const session = useSyncExternalStore(subscribeSession, readSession, () => emptySession);
  const [cleared, setCleared] = useState(false);
  const count = session.connections.length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-16 pb-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Southbank</p>
      <h1 className="font-serif mt-4 text-5xl italic leading-none tracking-tight">Settings</h1>
      <section className="mt-8 rounded-[28px] bg-white px-5 py-5 shadow-[0_12px_40px_rgba(60,40,20,0.06)]">
        <h2 className="text-lg font-semibold">Connections</h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          {count === 0 ? "None saved in this browser." : `${count} saved in this browser.`}
        </p>
        <button
          type="button"
          disabled={count === 0}
          onClick={() => {
            clearConnections();
            setCleared(true);
          }}
          className="mt-4 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          Clear connections
        </button>
        {cleared ? <p className="mt-3 text-sm text-stone-500">Cleared.</p> : null}
      </section>
      <Link href="/" className="mt-8 text-sm font-semibold text-stone-600">
        Back home
      </Link>
    </main>
  );
}
