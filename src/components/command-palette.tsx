"use client";

import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { filterCommands, type Command, type CommandGroup } from "@/components/commands";
import { emptySession, readSession, subscribeSession, type Session } from "@/components/session";
import { hydrateTheme, readTheme, subscribeTheme, toggleTheme, type Theme } from "@/components/theme";

const SPRING: Transition = { type: "spring", bounce: 0.2, duration: 0.4 };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const session = useSyncExternalStore(subscribeSession, readSession, () => emptySession);
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as const);
  const reduce = useReducedMotion() === true;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => menuGroups(session, pathname, theme), [session, pathname, theme]);
  const filtered = useMemo(() => filterCommands(groups, query), [groups, query]);
  const flat = useMemo(() => filtered.flatMap((group) => group.items), [filtered]);
  const transition = reduce ? { duration: 0 } : SPRING;

  useLayoutEffect(() => {
    hydrateTheme();
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        setQuery("");
        setSelectedIndex(0);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") event.stopPropagation();
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const selected = listRef.current?.querySelector("[data-selected=true]");
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, filtered]);

  function select(item: Command | undefined) {
    if (!item) return;
    if (item.id === "theme") {
      toggleTheme();
      return;
    }
    setOpen(false);
    if (item.href && item.href !== pathname) router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => (flat.length === 0 ? 0 : (index + 1) % flat.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => (flat.length === 0 ? 0 : (index - 1 + flat.length) % flat.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      select(flat[selectedIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  let index = 0;

  return (
    <>
      <button
        type="button"
        className="fixed left-3 top-3 z-40 flex items-center gap-2 rounded-full bg-white/90 py-2 pr-2 pl-3 text-sm font-semibold text-stone-900 shadow-[0_8px_24px_rgba(60,40,20,0.12)]"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="command-palette"
        aria-keyshortcuts="Meta+K"
        onClick={() => {
          setQuery("");
          setSelectedIndex(0);
          setOpen(true);
        }}
      >
        <SearchIcon />
        Menu
        <kbd className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-stone-500">⌘K</kbd>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.button
            key="backdrop"
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-50 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            onClick={() => setOpen(false)}
          />
        ) : null}
        {open ? (
          <motion.div
            key="dialog"
            id="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="menu-surface fixed top-16 left-1/2 z-50 w-[min(32rem,calc(100%-1.5rem))] overflow-hidden rounded-[28px] shadow-[0_24px_80px_rgba(60,40,20,0.18)] sm:top-[12%]"
            initial={reduce ? false : { opacity: 0, y: 12, x: "-50%", scale: 0.98 }}
            animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
            exit={{ opacity: 0, y: 8, x: "-50%", scale: 0.98 }}
            transition={transition}
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-stone-200 px-4">
              <SearchIcon />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search connections and pages"
                role="combobox"
                aria-expanded="true"
                aria-autocomplete="list"
                aria-label="Search connections and pages"
                aria-activedescendant={flat[selectedIndex] ? `command-${flat[selectedIndex].id}` : undefined}
                aria-controls="command-list"
                className="w-full bg-transparent py-4 text-base text-stone-900 outline-none placeholder:text-stone-400"
              />
              {query ? (
                <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="text-stone-500">
                  <CloseIcon />
                </button>
              ) : null}
            </div>
            <div ref={listRef} id="command-list" role="listbox" aria-label="Commands" className="max-h-[min(24rem,50vh)] overflow-y-auto px-2 py-2">
              {filtered.length > 0 ? (
                filtered.map((group) => (
                  <motion.div key={group.label} layout={reduce ? false : "position"}>
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{group.label}</p>
                    {group.items.map((item) => {
                      const itemIndex = index;
                      index += 1;
                      return (
                        <CommandRow
                          key={item.id}
                          item={item}
                          selected={itemIndex === selectedIndex}
                          transition={transition}
                          reduce={reduce}
                          onHover={() => setSelectedIndex(itemIndex)}
                          onSelect={() => select(item)}
                        />
                      );
                    })}
                  </motion.div>
                ))
              ) : (
                <p className="px-3 py-6 text-sm text-stone-500">No results for “{query}”</p>
              )}
              {session.connections.length === 0 && query.trim() === "" ? (
                <p className="px-3 py-3 text-sm text-stone-500">Swipe right on someone and they show up here.</p>
              ) : null}
            </div>
            <div className="flex gap-4 border-t border-stone-200 px-4 py-3 text-xs text-stone-500">
              <Hint keys="↑↓">navigate</Hint>
              <Hint keys="↵">select</Hint>
              <Hint keys="esc">close</Hint>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function menuGroups(session: Session, pathname: string, theme: Theme): CommandGroup[] {
  const go: CommandGroup = {
    label: "Go",
    items: [
      page("home", "Home", "Landing", "/", pathname),
      page("demo", "Demo", "Swipe to connect", "/demo", pathname),
      page("settings", "Settings", "Clear saved connections", "/settings", pathname),
      page("account", "Account", session.name || "Add your name", "/account", pathname),
      {
        id: "theme",
        label: theme === "dark" ? "Light mode" : "Dark mode",
        detail: "Light or dark palette",
      },
    ],
  };
  const people = session.connections.map((person) => ({
    id: `connection:${person.handle}`,
    label: person.displayName,
    href: `/connections/${encodeURIComponent(person.handle)}`,
    detail: [`@${person.handle}`, person.building, person.shared.join(" · ")].filter(Boolean).join(" · "),
  }));
  return people.length === 0 ? [go] : [go, { label: "Connections", items: people }];
}

function page(id: string, label: string, detail: string, href: string, pathname: string): Command {
  return { id, label, href, detail: pathname === href ? `${detail} · current` : detail };
}

function CommandRow({
  item,
  selected,
  transition,
  reduce,
  onHover,
  onSelect,
}: {
  item: Command;
  selected: boolean;
  transition: Transition;
  reduce: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      id={`command-${item.id}`}
      role="option"
      aria-selected={selected}
      data-selected={selected}
      className="relative cursor-pointer rounded-xl px-3 py-2"
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      {selected ? (
        <motion.div
          layoutId={reduce ? undefined : "command-highlight"}
          className="absolute inset-0 rounded-xl bg-white shadow-[0_8px_24px_rgba(60,40,20,0.06)]"
          transition={transition}
        />
      ) : null}
      <div className="relative min-w-0">
        <p className="truncate font-semibold tracking-tight text-stone-900">{item.label}</p>
        <p className="truncate text-sm text-stone-500">{item.detail}</p>
      </div>
    </div>
  );
}

function Hint({ keys, children }: { keys: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="rounded-md bg-white px-1.5 py-0.5 font-semibold text-stone-700">{keys}</kbd>
      {children}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 text-stone-400">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20 16.5 16.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
