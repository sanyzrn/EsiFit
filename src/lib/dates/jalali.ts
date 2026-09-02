import { toJalaali as j2j, toGregorian as j2g, jalaaliMonthLength } from "jalaali-js";

/**
 * Jalali (Shamsi) date utilities — the single source of Persian calendar logic.
 * - Timestamps stored in UTC (ISO strings); rendered here in Asia/Tehran by default.
 * - Date-only values stay date-only (no timezone shifting).
 */

export const DEFAULT_TIMEZONE = "Asia/Tehran";

export type JalaliDate = {
  jy: number;
  jm: number;
  jd: number;
};

const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

/** Weekday names starting Saturday (Persian week). */
export const JALALI_WEEKDAYS_SHORT = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
function faDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** Convert a JS Date (UTC instant) to Jalali parts rendered in the given IANA tz. */
export function toJalali(date: Date, timezone = DEFAULT_TIMEZONE): JalaliDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const gy = get("year");
  const gm = get("month");
  const gd = get("day");
  const { jy, jm, jd } = j2j(gy, gm, gd);
  return { jy, jm, jd };
}

/** Jalali parts → ISO date string (Gregorian, date-only, no timezone). */
export function jalaliToISO({ jy, jm, jd }: JalaliDate): string {
  const g = j2g(jy, jm, jd);
  return isoDateOnly(new Date(Date.UTC(g.gy, g.gm - 1, g.gd)));
}

/** ISO date-only string (YYYY-MM-DD) in the given timezone for an instant. */
export function isoDateOnly(date: Date, timezone = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts; // en-CA yields YYYY-MM-DD
}

/** Today's ISO date-only string in tz. */
export function todayISO(timezone = DEFAULT_TIMEZONE): string {
  return isoDateOnly(new Date(), timezone);
}

/** Parse an ISO date(-time) string safely (no TZ shift). Accepts "YYYY-MM-DD" and full timestamps. */
export function parseISODateOnly(iso: string): Date {
  const datePart = iso.split("T")[0];
  const [y, m, d] = datePart.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return new Date(NaN); // explicit invalid — callers can guard
  }
  return new Date(Date.UTC(y, m - 1, d));
}

/** ISO date-only + N days. */
export function addDaysISO(iso: string, days: number): string {
  const d = parseISODateOnly(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDateOnly(d);
}

/** Days between two ISO date-only strings (a - b). */
export function daysBetweenISO(a: string, b: string): number {
  const da = parseISODateOnly(a).getTime();
  const db = parseISODateOnly(b).getTime();
  return Math.round((da - db) / 86_400_000);
}

/** «۱۴۰۳/۰۵/۱۲» */
export function formatJalaliNumeric(
  date: Date | string,
  timezone = DEFAULT_TIMEZONE,
): string {
  const { jy, jm, jd } =
    typeof date === "string" ? toJalali(parseISODateOnly(date), timezone) : toJalali(date, timezone);
  const mm = String(jm).padStart(2, "0");
  const dd = String(jd).padStart(2, "0");
  return faDigits(`${jy}/${mm}/${dd}`);
}

/** «۱۲ مرداد ۱۴۰۳» */
export function formatJalaliLong(
  date: Date | string,
  timezone = DEFAULT_TIMEZONE,
): string {
  const { jy, jm, jd } =
    typeof date === "string" ? toJalali(parseISODateOnly(date), timezone) : toJalali(date, timezone);
  return faDigits(`${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`);
}

/** «شنبه، ۱۲ مرداد» (no year) */
export function formatJalaliWeekdayDay(
  date: Date | string,
  timezone = DEFAULT_TIMEZONE,
): string {
  const d = typeof date === "string" ? parseISODateOnly(date) : date;
  const { jm, jd } = toJalali(d, timezone);
  const weekday = new Intl.DateTimeFormat("fa-IR", { timeZone: timezone, weekday: "long" }).format(d);
  return `${weekday}، ${faDigits(jd)} ${JALALI_MONTHS[jm - 1]}`;
}

/** Month name by number 1..12. */
export function jalaliMonthName(jm: number): string {
  return JALALI_MONTHS[jm - 1] ?? "";
}

/** Weekday index 0..6 where 0=شنبه for an ISO date. */
export function persianWeekdayIndex(iso: string): number {
  const d = parseISODateOnly(iso);
  // JS getUTCDay: 0=Sunday..6=Saturday → Persian: 0=Saturday..6=Friday
  return (d.getUTCDay() + 1) % 7;
}

/** Format a UTC timestamp as Persian clock time «۱۸:۳۰». */
export function formatTime(
  date: Date | string,
  timezone = DEFAULT_TIMEZONE,
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return faDigits(parts);
}

/** Relative Persian time: «۵ دقیقه پیش» / «۳ ساعت پیش» / «دیروز». */
export function formatRelative(
  date: Date | string,
  now: Date = new Date(),
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "همین حالا";
  if (minutes < 60) return `${faDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${faDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "دیروز";
  if (days < 7) return `${faDigits(days)} روز پیش`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${faDigits(weeks)} هفته پیش`;
  }
  return formatJalaliLong(d);
}

/** Number of days in a Jalali month. */
export function jalaliMonthLength(jy: number, jm: number): number {
  return jalaaliMonthLength(jy, jm);
}

/** Build consecutive ISO dates ending today (inclusive), length n. */
export function lastNDaysISO(n: number, endISO = todayISO()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDaysISO(endISO, -i));
  return out;
}
