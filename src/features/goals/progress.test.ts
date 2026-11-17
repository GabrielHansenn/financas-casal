import { describe, expect, it } from "vitest";
import { computeGoalProgress, monthsUntil } from "./progress";

describe("monthsUntil", () => {
  it("counts the current month", () => {
    expect(monthsUntil("2026-11-17", "2026-11-30")).toBe(1);
    expect(monthsUntil("2026-11-17", "2026-11-17")).toBe(1);
  });

  it("counts whole months by day of month", () => {
    expect(monthsUntil("2026-11-17", "2026-12-10")).toBe(1);
    expect(monthsUntil("2026-11-17", "2026-12-17")).toBe(2);
    expect(monthsUntil("2026-11-17", "2027-11-17")).toBe(13);
  });

  it("is zero for a past deadline", () => {
    expect(monthsUntil("2026-11-17", "2026-11-16")).toBe(0);
  });
});

describe("computeGoalProgress", () => {
  const today = "2026-11-17";

  it("computes fraction and remaining without deadline", () => {
    expect(computeGoalProgress({ targetCents: 800000, currentCents: 80000, deadline: null, today })).toEqual({
      fraction: 0.1,
      remainingCents: 720000,
      reached: false,
      monthsLeft: null,
      monthlyNeededCents: null,
      overdue: false,
    });
  });

  it("monthly amount rounds up so the target is reached", () => {
    // R$ 1.000,00 left over 3 months -> 333,34 per month (never short by a cent)
    const p = computeGoalProgress({ targetCents: 100000, currentCents: 0, deadline: "2027-01-17", today });
    expect(p.monthsLeft).toBe(3);
    expect(p.monthlyNeededCents).toBe(33334);
    expect(p.monthlyNeededCents! * 3).toBeGreaterThanOrEqual(100000);
  });

  it("caps the bar at 100% when over-funded", () => {
    const p = computeGoalProgress({ targetCents: 1000, currentCents: 1500, deadline: "2027-01-01", today });
    expect(p).toMatchObject({ fraction: 1, remainingCents: 0, reached: true, monthlyNeededCents: null });
  });

  it("flags overdue goals", () => {
    const p = computeGoalProgress({ targetCents: 1000, currentCents: 100, deadline: "2026-10-01", today });
    expect(p).toMatchObject({ overdue: true, monthlyNeededCents: null, remainingCents: 900 });
  });

  it("a reached goal is never overdue", () => {
    expect(computeGoalProgress({ targetCents: 1000, currentCents: 1000, deadline: "2026-10-01", today }).overdue).toBe(false);
  });
});
