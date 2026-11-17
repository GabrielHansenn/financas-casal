import { describe, expect, it } from "vitest";
import {
  availableActions,
  conversionDefaults,
  isValidAchievedDate,
  shouldSuggestAchieved,
  statusAfterUndo,
  type LinkedGoal,
} from "./lifecycle";

const goal = (currentCents: number, targetCents = 100000): LinkedGoal => ({
  id: "g",
  name: "Japão",
  targetCents,
  currentCents,
  deadline: null,
  archived: false,
});

describe("availableActions", () => {
  it("dreaming can become a goal or be achieved directly", () => {
    expect(availableActions("dreaming")).toEqual(["convert_to_goal", "mark_achieved"]);
  });
  it("planning can only be achieved (it already has a goal)", () => {
    expect(availableActions("planning")).toEqual(["mark_achieved"]);
  });
  it("achieved can only be undone", () => {
    expect(availableActions("achieved")).toEqual(["undo_achieved"]);
  });
});

describe("statusAfterUndo", () => {
  it("returns to planning while the goal is linked, otherwise dreaming", () => {
    expect(statusAfterUndo("goal-id")).toBe("planning");
    expect(statusAfterUndo(null)).toBe("dreaming");
  });
});

describe("conversionDefaults", () => {
  it("uses the title and the exact estimated cost in cents, with no deadline", () => {
    expect(conversionDefaults({ title: " Viagem ao Japão ", estimatedCostCents: 1500050 })).toEqual({
      name: "Viagem ao Japão",
      targetCents: 1500050,
      deadline: null,
    });
  });

  it("leaves the target empty when there is no estimate", () => {
    expect(conversionDefaults({ title: "Casa", estimatedCostCents: null }).targetCents).toBe(0);
  });

  it("fits the goal name limit (60 chars)", () => {
    expect(conversionDefaults({ title: "x".repeat(80), estimatedCostCents: 1 }).name).toHaveLength(60);
  });
});

describe("shouldSuggestAchieved", () => {
  const today = "2026-11-17";
  it("suggests when the linked goal reached its target", () => {
    expect(shouldSuggestAchieved("planning", goal(100000), today)).toBe(true);
    expect(shouldSuggestAchieved("planning", goal(150000), today)).toBe(true);
  });
  it("does not suggest before the target or outside planning", () => {
    expect(shouldSuggestAchieved("planning", goal(99999), today)).toBe(false);
    expect(shouldSuggestAchieved("achieved", goal(100000), today)).toBe(false);
    expect(shouldSuggestAchieved("planning", null, today)).toBe(false);
  });
});

describe("isValidAchievedDate", () => {
  it("accepts today and past dates only", () => {
    expect(isValidAchievedDate("2026-11-17", "2026-11-17")).toBe(true);
    expect(isValidAchievedDate("2020-01-01", "2026-11-17")).toBe(true);
    expect(isValidAchievedDate("2026-11-18", "2026-11-17")).toBe(false);
    expect(isValidAchievedDate("17/11/2026", "2026-11-17")).toBe(false);
  });
});
