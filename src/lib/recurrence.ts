// Recurrence schedule math on plain ISO dates ("YYYY-MM-DD").
// Monthly/yearly rules keep the anchor day of `startDate`: a rule starting on the 31st
// falls on Feb 28/29, then goes back to the 31st in March.
import { addDays, daysInMonth, isISODate } from "./dates";

export type Frequency = "weekly" | "monthly" | "yearly";

export const MAX_OCCURRENCES_PER_RUN = 12;

function parts(iso: string): [number, number, number] {
  if (!isISODate(iso)) throw new RangeError(`Invalid date: ${iso}`);
  return iso.split("-").map(Number) as [number, number, number];
}

function toISO(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Date in a given month using the anchor day, clamped to the month length. */
function onAnchorDay(year: number, month: number, anchorDay: number): string {
  return toISO(year, month, Math.min(anchorDay, daysInMonth(year, month)));
}

/** The occurrence that follows `current` for a rule anchored at `startDate`. */
export function nextOccurrence(startDate: string, frequency: Frequency, current: string): string {
  const [, anchorMonth, anchorDay] = parts(startDate);
  const [y, m] = parts(current);
  switch (frequency) {
    case "weekly":
      return addDays(current, 7);
    case "monthly":
      return m === 12 ? onAnchorDay(y + 1, 1, anchorDay) : onAnchorDay(y, m + 1, anchorDay);
    case "yearly":
      return onAnchorDay(y + 1, anchorMonth, anchorDay);
  }
}

/** First occurrence of the rule on or after `date` (the start date itself if it is later). */
export function firstOccurrenceOnOrAfter(startDate: string, frequency: Frequency, date: string): string {
  if (startDate >= date) return startDate;
  const [, sm, sd] = parts(startDate);
  const [y, m] = parts(date);
  let candidate: string;
  if (frequency === "weekly") {
    const diffDays = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000);
    candidate = addDays(startDate, Math.ceil(diffDays / 7) * 7);
  } else if (frequency === "monthly") {
    candidate = onAnchorDay(y, m, sd);
  } else {
    candidate = onAnchorDay(y, sm, sd);
  }
  // Jump straight to the right period, then step forward at most once or twice
  while (candidate < date) candidate = nextOccurrence(startDate, frequency, candidate);
  return candidate;
}

export type RecurrenceSchedule = {
  startDate: string;
  nextDate: string;
  endDate: string | null;
  frequency: Frequency;
};

/**
 * Dates due up to `today` (inclusive), oldest first, capped at `max` per run, and the
 * next_date to store afterwards. Nothing is due when next_date is in the future or past the end.
 */
export function dueOccurrences(
  rule: RecurrenceSchedule,
  today: string,
  max = MAX_OCCURRENCES_PER_RUN,
): { dates: string[]; nextDate: string } {
  const dates: string[] = [];
  let date = rule.nextDate;
  while (date <= today && (rule.endDate === null || date <= rule.endDate) && dates.length < max) {
    dates.push(date);
    date = nextOccurrence(rule.startDate, rule.frequency, date);
  }
  return { dates, nextDate: date };
}

export function isFinished(rule: Pick<RecurrenceSchedule, "nextDate" | "endDate">): boolean {
  return rule.endDate !== null && rule.nextDate > rule.endDate;
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "Toda semana, às segundas" · "Todo mês, dia 5" · "Todo ano, 5 de março" */
export function describeSchedule(startDate: string, frequency: Frequency): string {
  const [, m, d] = parts(startDate);
  switch (frequency) {
    case "weekly": {
      const weekday = new Date(`${startDate}T00:00:00Z`).getUTCDay();
      const name = WEEKDAYS[weekday]!;
      return weekday === 0 || weekday === 6 ? `Toda semana, aos ${name}s` : `Toda semana, às ${name}s`;
    }
    case "monthly":
      return d >= 29 ? `Todo mês, dia ${d} (ou o último dia do mês)` : `Todo mês, dia ${d}`;
    case "yearly":
      return `Todo ano, ${d} de ${MONTHS[m - 1]}`;
  }
}
