"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { emptySession, readSession, saveAccountName, subscribeSession } from "@/components/session";

export default function AccountPage() {
  const session = useSyncExternalStore(subscribeSession, readSession, () => emptySession);
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? session.name;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-16 pb-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Southbank</p>
      <h1 className="font-serif mt-4 text-5xl italic leading-none tracking-tight">Account</h1>
      <p className="mt-4 text-lg leading-snug text-stone-600">Your name stays in this browser. Signing out clears it. Connections stay until you clear them in Settings.</p>
      <form
        className="mt-8"
        onSubmit={(event) => {
          event.preventDefault();
          saveAccountName(name);
          setDraft(null);
        }}
      >
        <label className="block rounded-[28px] bg-white px-5 py-5 shadow-[0_18px_50px_rgba(60,40,20,0.08)]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Name</span>
          <input
            value={name}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={80}
            placeholder="Ada Okonkwo"
            autoComplete="name"
            className="mt-3 w-full bg-transparent text-2xl text-stone-900 outline-none placeholder:text-stone-400"
          />
        </label>
        <button type="submit" disabled={name.trim().length === 0} className="mt-4 w-full rounded-full bg-stone-900 py-4 text-base font-semibold text-white disabled:opacity-40">
          Save
        </button>
      </form>
      {session.name ? (
        <button
          type="button"
          onClick={() => {
            saveAccountName("");
            setDraft("");
          }}
          className="mt-3 py-2 text-sm font-semibold text-stone-600"
        >
          Sign out
        </button>
      ) : null}
      <Link href="/" className="mt-6 text-sm font-semibold text-stone-600">
        Back home
      </Link>
    </main>
  );
}
