/**
 * Persian-aware text matching for the exercise library.
 *
 * Typed Persian is messy: Arabic ي/ك keyboards, ZWNJ vs space, Persian vs Latin
 * digits, stray diacritics. Everything is folded to one comparable form before
 * matching, and gym shorthand (ddl, rdl, ohp…) maps to the Persian names.
 */

const DIGITS: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

export function normalizeFa(input: string): string {
  return input
    .replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d] ?? d)
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ةۀ]/g, "ه")
    .replace(/[ؤ]/g, "و")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ً-ٰٟـ]/g, "") // harakat, dagger alef, tatweel
    .replace(/[‌‍‏‎]/g, " ") // ZWNJ & friends → space
    .replace(/[()\-_/،,.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Gym shorthand → Persian terms that appear in exercise names. */
const SHORTHAND: Record<string, string[]> = {
  dl: ["ددلیفت"],
  rdl: ["ددلیفت رومانیایی"],
  sldl: ["ددلیفت"],
  bp: ["پرس سینه"],
  ohp: ["پرس سرشانه"],
  sq: ["اسکوات"],
  db: ["دمبل"],
  bb: ["هالتر"],
  kb: ["کتل بل"],
  pu: ["بارفیکس"],
  lat: ["زیربغل"],
  lunge: ["لانج"],
};

/** Edit distance, bailing out as soon as it must exceed `max`. */
const levenshtein = (a: string, b: string, max: number): number => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    if (Math.min(...cur) > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
};

/**
 * Relevance of `haystack` for `query`: 0 = no match, higher = better.
 * Order: exact > prefix > whole-word > substring > all tokens present > one-typo tokens.
 */
export function matchScore(query: string, haystack: string): number {
  const q = normalizeFa(query);
  const h = normalizeFa(haystack);
  if (!q) return 1;
  if (h === q) return 100;
  if (h.startsWith(q)) return 90;
  const words = h.split(" ");
  if (words.includes(q)) return 80;
  if (h.includes(q)) return 70;

  const tokens = q.split(" ").filter(Boolean);
  const expanded = tokens.flatMap((t) => (SHORTHAND[t] ? [t, ...SHORTHAND[t].map(normalizeFa)] : [t]));
  // Every query token must hit some word (prefix match counts).
  const hitsAll = (toks: string[]) => toks.every((t) => words.some((w) => w.startsWith(t) || h.includes(t)));
  if (tokens.length > 1 && hitsAll(tokens)) return 60;
  if (tokens.length === 1 && SHORTHAND[tokens[0]]) {
    const alt = SHORTHAND[tokens[0]].map(normalizeFa);
    if (alt.some((a) => h.includes(a))) return 55;
  }
  if (expanded.length > tokens.length && hitsAll(expanded.filter((t) => !SHORTHAND[t]))) return 50;

  // Typo tolerance: one edit per token for tokens of 4+ letters.
  const typoOk = tokens.every((t) =>
    t.length >= 4 ? words.some((w) => levenshtein(t, w.slice(0, t.length + 1), 1) <= 1 || levenshtein(t, w, 1) <= 1) : words.some((w) => w.startsWith(t)),
  );
  return typoOk ? 30 : 0;
}

/** Filter + rank. Stable for equal scores, so the caller's order breaks ties. */
export function rankBySearch<T>(items: readonly T[], query: string, texts: (item: T) => string[]): T[] {
  if (!normalizeFa(query)) return [...items];
  return items
    .map((item, index) => ({ item, index, score: Math.max(0, ...texts(item).map((t) => matchScore(query, t))) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item);
}
