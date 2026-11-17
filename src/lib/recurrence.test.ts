import { describe, expect, it } from "vitest";
import {
  describeSchedule,
  dueOccurrences,
  firstOccurrenceOnOrAfter,
  isFinished,
  MAX_OCCURRENCES_PER_RUN,
  nextOccurrence,
} from "./recurrence";

describe("nextOccurrence", () => {
  it("weekly adds 7 days across months", () => {
    expect(nextOccurrence("2026-11-27", "weekly", "2026-11-27")).toBe("2026-12-04");
  });

  it("monthly keeps the anchor day, clamping short months", () => {
    const start = "2026-01-31";
    const feb = nextOccurrence(start, "monthly", start);
    expect(feb).toBe("2026-02-28");
    const mar = nextOccurrence(start, "monthly", feb);
    expect(mar).toBe("2026-03-31"); // back to the 31st, not stuck on the 28th
    expect(nextOccurrence(start, "monthly", mar)).toBe("2026-04-30");
  });

  it("monthly handles leap years and the year boundary", () => {
    expect(nextOccurrence("2028-01-30", "monthly", "2028-01-30")).toBe("2028-02-29");
    expect(nextOccurrence("2026-12-15", "monthly", "2026-12-15")).toBe("2027-01-15");
  });

  it("yearly on Feb 29 falls on Feb 28 and comes back in leap years", () => {
    const start = "2028-02-29";
    const y1 = nextOccurrence(start, "yearly", start);
    expect(y1).toBe("2029-02-28");
    expect(nextOccurrence(start, "yearly", "2031-02-28")).toBe("2032-02-29");
  });
});

describe("dueOccurrences", () => {
  const monthly = { startDate: "2026-08-05", nextDate: "2026-09-05", endDate: null, frequency: "monthly" as const };

  it("returns every due date up to today (inclusive) and the next one", () => {
    expect(dueOccurrences(monthly, "2026-11-05")).toEqual({
      dates: ["2026-09-05", "2026-10-05", "2026-11-05"],
      nextDate: "2026-12-05",
    });
  });

  it("returns nothing when the next date is in the future", () => {
    expect(dueOccurrences(monthly, "2026-09-04")).toEqual({ dates: [], nextDate: "2026-09-05" });
  });

  it("stops at the end date", () => {
    const result = dueOccurrences({ ...monthly, endDate: "2026-10-20" }, "2026-12-31");
    expect(result.dates).toEqual(["2026-09-05", "2026-10-05"]);
    expect(result.nextDate).toBe("2026-11-05");
    expect(isFinished({ nextDate: result.nextDate, endDate: "2026-10-20" })).toBe(true);
  });

  it("caps the catch-up per run", () => {
    const weekly = { startDate: "2020-01-01", nextDate: "2020-01-01", endDate: null, frequency: "weekly" as const };
    const result = dueOccurrences(weekly, "2026-11-17");
    expect(result.dates).toHaveLength(MAX_OCCURRENCES_PER_RUN);
    expect(result.nextDate).toBe(nextOccurrence("2020-01-01", "weekly", result.dates.at(-1)!));
  });
});

describe("firstOccurrenceOnOrAfter", () => {
  it("returns the start date when it is in the future", () => {
    expect(firstOccurrenceOnOrAfter("2026-12-10", "monthly", "2026-11-17")).toBe("2026-12-10");
  });

  it("finds the next monthly date with the anchor day", () => {
    expect(firstOccurrenceOnOrAfter("2026-01-31", "monthly", "2026-02-10")).toBe("2026-02-28");
    expect(firstOccurrenceOnOrAfter("2026-01-05", "monthly", "2026-11-17")).toBe("2026-12-05");
    expect(firstOccurrenceOnOrAfter("2026-01-17", "monthly", "2026-11-17")).toBe("2026-11-17");
  });

  it("finds the next weekly and yearly dates", () => {
    expect(firstOccurrenceOnOrAfter("2026-11-02", "weekly", "2026-11-17")).toBe("2026-11-23");
    expect(firstOccurrenceOnOrAfter("2020-03-05", "yearly", "2026-11-17")).toBe("2027-03-05");
  });
});

describe("describeSchedule", () => {
  it("describes each frequency in pt-BR", () => {
    expect(describeSchedule("2026-11-16", "weekly")).toBe("Toda semana, às segundas");
    expect(describeSchedule("2026-11-15", "weekly")).toBe("Toda semana, aos domingos");
    expect(describeSchedule("2026-11-05", "monthly")).toBe("Todo mês, dia 5");
    expect(describeSchedule("2026-01-31", "monthly")).toBe("Todo mês, dia 31 (ou o último dia do mês)");
    expect(describeSchedule("2026-03-05", "yearly")).toBe("Todo ano, 5 de março");
  });
});
