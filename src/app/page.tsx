import Link from "next/link";

const steps = [
  {
    title: "Say what you’re working on",
    body: "A sentence is enough. Specific words — Rust, bots, check-in — find people. Everyday words like “working” are set aside.",
  },
  {
    title: "Meet the people who share them",
    body: "Each card shows what they’re building, the help they want, what they can offer, and a topic they’d talk about. Words you have in common are marked.",
  },
  {
    title: "Swipe right when you want to talk",
    body: "Left moves on. A connection stays in this browser, with their name and what they’re building, until you clear it.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-x-hidden px-6 pb-24 pt-16">
      <div className="stage" aria-hidden="true">
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <span className="orb orb-c" />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">Southbank</p>
        <h1 className="font-serif mt-6 text-5xl italic leading-[0.95] tracking-tight text-stone-900 sm:text-7xl">
          Welcome. Tell us what you’re making.
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-stone-600">
          Southbank is a room of people who already said what they’re building. Write yours, and you’ll see who shares the words.
        </p>
        <Link
          href="/demo"
          className="mt-8 inline-block rounded-full bg-stone-900 px-8 py-4 text-base font-semibold text-white"
        >
          Start with a sentence
        </Link>

        <ol className="mt-16 space-y-4">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-[28px] border border-white/70 bg-white/80 px-5 py-5 shadow-[0_12px_40px_rgba(60,40,20,0.06)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-900">{step.title}</h2>
              <p className="mt-2 text-base leading-relaxed text-stone-600">{step.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-10 max-w-md text-sm leading-relaxed text-stone-500">
          Only people who opted in appear. Your connections stay on this device.
        </p>
        <Link href="/demo" className="mt-4 inline-block text-sm font-semibold text-stone-800">
          Open the deck
        </Link>
      </div>
    </main>
  );
}
