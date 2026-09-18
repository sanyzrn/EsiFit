/**
 * Persian (fa-IR) number & currency formatting.
 * Central helper per DESIGN_BIBLE §13/§14 — never use raw toLocaleString inline.
 */

const FA_LOCALE = "fa-IR";

/** Format a number with Persian digits and Persian group separator. */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(FA_LOCALE, {
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}

/** Integer formatting — no fractional digits. */
export function formatInt(value: number): string {
  return formatNumber(value, { maximumFractionDigits: 0 });
}

/** Decimal formatting with fixed fraction digits. */
export function formatDecimal(value: number, digits = 1): string {
  return formatNumber(value, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Percent with Persian digits. `0.75` → «۷۵٪». */
export function formatPercent(ratio: number, digits = 0): string {
  return `${formatNumber(ratio * 100, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })}٪`;
}

/** Signed delta, e.g. «+۲٫۴» / «−۱٫۰». */
export function formatDelta(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(value), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/** Compact large numbers: ۱۲٫۵ هزار / ۱٫۲ میلیون */
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${formatDecimal(value / 1_000_000, 1)} میلیون`;
  }
  if (Math.abs(value) >= 10_000) {
    return `${formatCompactThousand(value)}`;
  }
  return formatInt(value);
}

function formatCompactThousand(value: number): string {
  return `${formatDecimal(value / 1_000, 1)} هزار`;
}

/** Toman currency. */
export function formatToman(amount: number): string {
  return `${formatInt(amount)} تومان`;
}

/** Convert Latin digits in a string to Persian digits (for static labels). */
const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/** Normalize Persian/Arabic digits to Latin for input parsing. */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** Parse a locale-friendly numeric string into a canonical number. */
export function parseLocaleNumber(input: string): number | null {
  const normalized = toLatinDigits(input)
    // Unicode minus → ASCII minus
    .replace(/[−–—]/g, "-")
    // Strip thousands separators (Latin comma, Arabic thousands U+066C)
    .replace(/[٬,]/g, "")
    // Persian decimal separator → ASCII decimal
    .replace(/[٫]/g, ".")
    .replace(/[^\d.-]/g, "");
  if (!normalized || normalized === "-" || normalized === ".") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Format duration seconds → «۴۵:۳۰» or «۱:۰۲:۰۳». */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const latin = hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
  return toPersianDigits(latin);
}

/** Humanized Persian duration: «۴۵ دقیقه» / «۱ ساعت و ۲۰ دقیقه». */
export function formatDurationMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${formatInt(m)} دقیقه`;
  const hours = Math.floor(m / 60);
  const rest = m % 60;
  if (rest === 0) return `${formatInt(hours)} ساعت`;
  return `${formatInt(hours)} ساعت و ${formatInt(rest)} دقیقه`;
}
