import { describe, expect, it } from "vitest";
import {
  addMonths,
  currentMonth,
  daysInMonth,
  formatDateBR,
  formatDayLabel,
  formatMonthLabel,
  isISODate,
  monthRange,
  todayISO,
} from "./dates";

describe("todayISO", () => {
  it("uses America/Sao_Paulo, not the server time zone", () => {
    // 02:30 UTC on Nov 18 is still 23:30 on Nov 17 in São Paulo (UTC-3)
    expect(todayISO(new Date("2026-11-18T02:30:00Z"))).toBe("2026-11-17");
    // 03:00 UTC is midnight in São Paulo
    expect(todayISO(new Date("2026-11-18T03:00:00Z"))).toBe("2026-11-18");
  });

  it("derives the current month in the same time zone", () => {
    expect(currentMonth(new Date("2026-12-01T01:00:00Z"))).toBe("2026-11");
  });
});

describe("month helpers", () => {
  it("knows month lengths including leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 12)).toBe(31);
    expect(daysInMonth(2026, 11)).toBe(30);
  });

  it("returns the first and last day of a month", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("adds months across year boundaries", () => {
    expect(addMonths("2026-11", 1)).toBe("2026-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-05", -17)).toBe("2024-12");
  });

  it("rejects invalid input", () => {
    expect(() => monthRange("2026-13")).toThrow(RangeError);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-02-28")).toBe(true);
  });
});

describe("formatting", () => {
  it("formats dates in pt-BR without shifting the day", () => {
    expect(formatDateBR("2026-11-01")).toBe("01/11/2026");
    expect(formatMonthLabel("2026-11")).toBe("novembro de 2026");
    expect(formatDayLabel("2026-11-17")).toBe("terça-feira, 17 de novembro");
  });
});
