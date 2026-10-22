export type Theme = "light" | "dark";

const THEME_COOKIE = "southbank.theme";

export function nextTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}

let theme: Theme = "light";
const listeners = new Set<() => void>();

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readTheme(): Theme {
  return theme;
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function hydrateTheme(): void {
  if (typeof document === "undefined") return;
  const next: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  if (next === theme) return;
  theme = next;
  emit();
}

export function toggleTheme(): void {
  const current: Theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
  const next = nextTheme(current);
  theme = next;
  document.documentElement.classList.toggle("dark", next === "dark");
  document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  emit();
}
