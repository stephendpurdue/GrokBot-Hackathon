import type { Attempt, IntroRunResult } from "../contract/schema";

export type StoredAttempt = Attempt & { createdAt: string };

type WeekMemory = { result: IntroRunResult; keys: string[] };

const weeks = new Map<string, WeekMemory>();
const attempts: StoredAttempt[] = [];

export const memory = {
  weeks,
  attempts,
  clear() {
    weeks.clear();
    attempts.length = 0;
  },
};

export function rememberAttempts(rows: Attempt[]) {
  const createdAt = new Date().toISOString();
  attempts.unshift(...rows.map((row) => ({ ...row, createdAt })));
}
