// Date helpers. Transaction dates are plain calendar dates ("YYYY-MM-DD") interpreted in the
// app time zone, regardless of where the server runs (Vercel runs in UTC).

export const APP_TIME_ZONE = "America/Sao_Paulo";

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

/** Today's date in the app time zone, as "YYYY-MM-DD". */
export function todayISO(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return isoDateFormatter.format(now);
}

/** Current month in the app time zone, as "YYYY-MM". */
export function currentMonth(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function isISODate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function isISOMonth(value: string): boolean {
  const match = ISO_MONTH.exec(value);
  return !!match && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

/** Number of days in a month (month is 1-12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** First and last day of a "YYYY-MM" month, as ISO dates. */
export function monthRange(month: string): { from: string; to: string } {
  if (!isISOMonth(month)) throw new RangeError(`Invalid month: ${month}`);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(daysInMonth(y, m)).padStart(2, "0")}` };
}

/** Shifts a "YYYY-MM" month by `delta` months. */
export function addMonths(month: string, delta: number): string {
  if (!isISOMonth(month)) throw new RangeError(`Invalid month: ${month}`);
  const [y, m] = month.split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + delta;
  const year = Math.floor(index / 12);
  const mon = (index % 12) + 1;
  return `${year}-${String(mon).padStart(2, "0")}`;
}

// Formatting uses UTC because ISO dates are parsed as UTC midnight below.
const dateBRFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});
const weekdayLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
});

function isoToUTCDate(iso: string): Date {
  if (!isISODate(iso)) throw new RangeError(`Invalid date: ${iso}`);
  return new Date(`${iso}T00:00:00Z`);
}

/** "2026-11-17" -> "17/11/2026" */
export function formatDateBR(iso: string): string {
  return dateBRFormatter.format(isoToUTCDate(iso));
}

/** "2026-11" -> "novembro de 2026" */
export function formatMonthLabel(month: string): string {
  return monthLabelFormatter.format(isoToUTCDate(`${month}-01`));
}

/** "2026-11-17" -> "terça-feira, 17 de novembro" */
export function formatDayLabel(iso: string): string {
  return weekdayLabelFormatter.format(isoToUTCDate(iso));
}
