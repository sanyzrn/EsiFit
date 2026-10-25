import { addDaysISO, daysBetweenISO } from "@/lib/dates/jalali";

/** Date keys are already in the user's calendar. Multiple events on a day count once. */
export function currentDayStreak(dates: Iterable<string>, today: string): number {
  const days = new Set(dates);
  let cursor = days.has(today) ? today : addDaysISO(today, -1);
  let count = 0;
  while (days.has(cursor)) { count++; cursor = addDaysISO(cursor, -1); }
  return count;
}

/** Badges remain earned after a streak ends; historical backfill can qualify. */
export function longestDayStreak(dates: Iterable<string>): number {
  const days = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && daysBetweenISO(days[i], days[i - 1]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}
