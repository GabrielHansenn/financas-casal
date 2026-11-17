import { PartyPopperIcon, TargetIcon } from "lucide-react";
import Link from "next/link";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { GoalProgressBar } from "@/features/goals/components/goal-progress-bar";
import { computeGoalProgress } from "@/features/goals/progress";
import { shouldSuggestAchieved, type LinkedGoal } from "../lifecycle";
import type { DreamStatus } from "../labels";

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

/** Linked goal progress (card footer or detail section). Works in Server and Client Components. */
export function DreamGoalProgress({
  goal,
  status,
  today,
  compact = false,
}: {
  goal: LinkedGoal;
  status: DreamStatus;
  today: string;
  compact?: boolean;
}) {
  const progress = computeGoalProgress({ ...goal, today });
  const suggest = shouldSuggestAchieved(status, goal, today);

  return (
    <div className={cn("grid gap-1.5", !compact && "rounded-xl border p-3")}>
      {!compact ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-1.5 font-medium">
            <TargetIcon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">Meta: {goal.name}</span>
          </span>
          <Link href={`/metas#goal-${goal.id}`} className="shrink-0 text-xs text-primary underline-offset-4 hover:underline">
            Ver meta
          </Link>
        </div>
      ) : null}
      <GoalProgressBar fraction={progress.fraction} reached={progress.reached} label={`Progresso da meta ${goal.name}`} />
      <p className="text-xs text-muted-foreground tabular-nums">
        {formatBRL(goal.currentCents)} de {formatBRL(goal.targetCents)} · {percent.format(progress.fraction)}
        {goal.archived ? " · meta arquivada" : ""}
      </p>
      {suggest ? (
        <p className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <PartyPopperIcon className="size-3.5 shrink-0" aria-hidden />
          {compact ? "Meta alcançada! Marcar como realizado?" : "A meta foi alcançada! Que tal marcar o sonho como realizado?"}
        </p>
      ) : null}
    </div>
  );
}
