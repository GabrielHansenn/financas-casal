// Goal progress math (unit tested). Amounts in integer cents, dates as ISO strings.

export type GoalProgress = {
  /** 0..1, clamped (a goal can be over-funded, the bar stops at 100%) */
  fraction: number;
  remainingCents: number;
  reached: boolean;
  /** Months left until the deadline, counting the current month; null without deadline */
  monthsLeft: number | null;
  /** How much to put aside per month to reach the target on time; null if not applicable */
  monthlyNeededCents: number | null;
  overdue: boolean;
};

/**
 * Whole months from `today` to `deadline`, counting the current month as one:
 * 2026-11-17 → 2026-11-30 = 1, → 2026-12-17 = 2, → 2026-12-10 = 1.
 */
export function monthsUntil(today: string, deadline: string): number {
  if (deadline < today) return 0;
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  const [dy, dm, dd] = deadline.split("-").map(Number) as [number, number, number];
  const full = (dy - ty) * 12 + (dm - tm) - (dd < td ? 1 : 0);
  return Math.max(1, full + 1);
}

export function computeGoalProgress(goal: {
  targetCents: number;
  currentCents: number;
  deadline: string | null;
  today: string;
}): GoalProgress {
  const current = Math.max(0, goal.currentCents);
  const remainingCents = Math.max(0, goal.targetCents - current);
  const reached = remainingCents === 0;
  const fraction = goal.targetCents > 0 ? Math.min(1, current / goal.targetCents) : 0;

  if (!goal.deadline) {
    return { fraction, remainingCents, reached, monthsLeft: null, monthlyNeededCents: null, overdue: false };
  }
  const overdue = !reached && goal.deadline < goal.today;
  const monthsLeft = monthsUntil(goal.today, goal.deadline);
  const monthlyNeededCents = reached || overdue || monthsLeft === 0 ? null : Math.ceil(remainingCents / monthsLeft);
  return { fraction, remainingCents, reached, monthsLeft, monthlyNeededCents, overdue };
}
