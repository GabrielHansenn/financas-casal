// Dream lifecycle rules (unit tested): which actions each status allows, defaults for the
// "turn into a goal" dialog and when to suggest marking a dream as achieved.
import { computeGoalProgress } from "@/features/goals/progress";
import type { DreamStatus } from "./labels";

export type DreamAction = "convert_to_goal" | "mark_achieved" | "undo_achieved";

export type LinkedGoal = {
  id: string;
  name: string;
  targetCents: number;
  currentCents: number;
  deadline: string | null;
  archived: boolean;
};

/** Actions offered for a dream (the database enforces the same transitions). */
export function availableActions(status: DreamStatus): DreamAction[] {
  switch (status) {
    case "dreaming":
      return ["convert_to_goal", "mark_achieved"];
    case "planning":
      return ["mark_achieved"];
    case "achieved":
      return ["undo_achieved"];
  }
}

/** Status after undoing "achieved": back to planning while the goal is still linked. */
export function statusAfterUndo(goalId: string | null): DreamStatus {
  return goalId ? "planning" : "dreaming";
}

/**
 * Prefill for "Transformar em meta": the dream title and the estimated cost (exact cents).
 * No automatic deadline: the couple picks it (null = no deadline).
 */
export function conversionDefaults(dream: { title: string; estimatedCostCents: number | null }) {
  return {
    name: dream.title.trim().slice(0, 60),
    targetCents: dream.estimatedCostCents && dream.estimatedCostCents > 0 ? dream.estimatedCostCents : 0,
    deadline: null as string | null,
  };
}

/** Linked goal reached its target (balance >= target) while the dream is still planning. */
export function shouldSuggestAchieved(status: DreamStatus, goal: LinkedGoal | null, today: string): boolean {
  if (status !== "planning" || !goal) return false;
  return computeGoalProgress({ ...goal, today }).reached;
}

/** The achievement date can be any day up to today (not in the future). */
export function isValidAchievedDate(date: string, today: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today;
}
