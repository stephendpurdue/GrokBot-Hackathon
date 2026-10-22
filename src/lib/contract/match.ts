export type Profile = {
  id: string;
  displayName: string;
  consentIntros: boolean;
  offers: string[];
  wants: string[];
  builds: string[];
  talks: string[];
};

export type ScoredPair = {
  a: Profile;
  b: Profile;
  score: number;
  reasons: string[];
  key: string;
};

const intersect = (a: string[], b: string[]) => a.filter((x) => b.includes(x));

export function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Monday of the calendar week that contains YYYY-MM-DD. Pure date math, no time zone. */
export function weekStart(asOf: string): string {
  const [y, m, d] = asOf.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  const day = utc.getUTCDay(); // 0 Sun .. 6 Sat
  const delta = day === 0 ? -6 : 1 - day;
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

export function scorePair(a: Profile, b: Profile) {
  const aGets = intersect(a.wants, b.offers);
  const bGets = intersect(b.wants, a.offers);
  const reasons = [
    ...aGets.map((t) => `${b.displayName} offers ${t}, which ${a.displayName} wants`),
    ...bGets.map((t) => `${a.displayName} offers ${t}, which ${b.displayName} wants`),
  ];
  const complement = aGets.length + bGets.length;
  if (complement < 1) return { score: 0, reasons: [] as string[] };
  const shared = intersect(a.builds, b.builds).length + intersect(a.talks, b.talks).length;
  return { score: 3 * complement + shared, reasons };
}

/** One partner per member. Prior keys (any week) are excluded. Names ordered for display. */
export function pickWeeklyPairs(members: Profile[], usedPairKeys: Set<string>): ScoredPair[] {
  const eligible = members.filter((m) => m.consentIntros);
  const candidates: ScoredPair[] = [];
  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const left = eligible[i];
      const right = eligible[j];
      const key = pairKey(left.id, right.id);
      if (usedPairKeys.has(key)) continue;
      const { score, reasons } = scorePair(left, right);
      if (score < 1) continue;
      const [a, b] = left.displayName < right.displayName ? [left, right] : [right, left];
      candidates.push({ a, b, score, reasons, key });
    }
  }
  candidates.sort(
    (p, q) =>
      q.score - p.score ||
      p.a.displayName.localeCompare(q.a.displayName) ||
      p.b.displayName.localeCompare(q.b.displayName),
  );
  const used = new Set<string>();
  const picked: ScoredPair[] = [];
  for (const c of candidates) {
    if (used.has(c.a.id) || used.has(c.b.id)) continue;
    used.add(c.a.id);
    used.add(c.b.id);
    picked.push(c);
  }
  return picked;
}

export function topicWords(topic: string) {
  return topic.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
}

export function memberTopicHits(m: Profile, topic: string) {
  const text = [...m.offers, ...m.wants, ...m.builds, ...m.talks].join(" ").toLowerCase();
  return topicWords(topic).filter((w) => text.includes(w));
}
