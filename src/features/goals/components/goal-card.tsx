"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateBR, formatMonthLabel } from "@/lib/dates";
import { formatBRL, formatSignedBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { deleteContribution, deleteGoal, setGoalArchived } from "../actions";
import { computeGoalProgress } from "../progress";
import type { GoalItem } from "../types";
import { ContributionDialog } from "./contribution-dialog";
import { GoalDialog } from "./goal-dialog";
import { GoalProgressBar } from "./goal-progress-bar";

const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const HISTORY_PREVIEW = 20;

export function GoalCard({
  goal,
  workspaceId,
  today,
  currentUserId,
  memberNames,
}: {
  goal: GoalItem;
  workspaceId: string;
  today: string;
  currentUserId: string;
  memberNames: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();
  const progress = computeGoalProgress({ ...goal, today });
  const who = (userId: string) => (userId === currentUserId ? "Você" : (memberNames[userId] ?? "Ex-membro"));

  const toggleArchived = () =>
    startTransition(async () => {
      const result = await setGoalArchived(goal.id, !goal.archived);
      if (result.ok) toast.success(goal.archived ? "Meta desarquivada" : "Meta arquivada");
      else toast.error(result.error);
    });

  return (
    <Card className={cn(goal.archived && "opacity-75")}>
      <CardHeader className="grid gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <CardTitle className="flex items-center gap-2">
              <span className="truncate">{goal.name}</span>
              {progress.reached ? (
                <Badge className="bg-emerald-600 text-white">
                  <CheckCircle2Icon aria-hidden /> Alcançada
                </Badge>
              ) : null}
              {goal.archived ? <Badge variant="secondary">Arquivada</Badge> : null}
            </CardTitle>
            <p className="text-sm text-muted-foreground tabular-nums">
              <span className="font-semibold text-foreground">{formatBRL(goal.currentCents)}</span> de{" "}
              {formatBRL(goal.targetCents)} · {percentFormatter.format(progress.fraction)}
            </p>
          </div>
          <GoalDialog
            workspaceId={workspaceId}
            today={today}
            goal={goal}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Editar meta ${goal.name}`}>
                <PencilIcon />
              </Button>
            }
          />
        </div>
        <GoalProgressBar fraction={progress.fraction} reached={progress.reached} label={`Progresso de ${goal.name}`} />
        <p className="text-xs text-muted-foreground">
          {progress.reached
            ? "Meta alcançada. Arquive quando não precisar mais acompanhar."
            : progress.overdue
              ? `O prazo (${formatDateBR(goal.deadline!)}) passou. Faltam ${formatBRL(progress.remainingCents)}.`
              : progress.monthlyNeededCents !== null
                ? `Faltam ${formatBRL(progress.remainingCents)}: ${formatBRL(progress.monthlyNeededCents)} por mês até ${formatMonthLabel(goal.deadline!.slice(0, 7))}.`
                : `Faltam ${formatBRL(progress.remainingCents)}.`}
        </p>
      </CardHeader>

      <CardContent className="grid gap-4">
        {!goal.archived ? (
          <div className="flex flex-wrap gap-2">
            <ContributionDialog
              goal={goal}
              today={today}
              initialKind="deposit"
              trigger={
                <Button size="sm">
                  <ArrowUpIcon aria-hidden /> Aportar
                </Button>
              }
            />
            <ContributionDialog
              goal={goal}
              today={today}
              initialKind="withdrawal"
              trigger={
                <Button size="sm" variant="outline" disabled={goal.currentCents <= 0}>
                  <ArrowDownIcon aria-hidden /> Resgatar
                </Button>
              }
            />
          </div>
        ) : null}

        {goal.contributions.length > 0 ? (
          <details className="group rounded-lg border">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
              Histórico ({goal.contributions.length})
            </summary>
            <ul className="divide-y border-t">
              {goal.contributions.slice(0, HISTORY_PREVIEW).map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="grid min-w-0 flex-1">
                    <span className="text-sm">
                      {who(c.createdBy)} {c.amountCents > 0 ? "aportou" : "resgatou"}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {formatDateBR(c.date)}
                      {c.note ? ` · ${c.note}` : ""}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      c.amountCents > 0 && "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {formatSignedBRL(c.amountCents)}
                  </span>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="Excluir movimentação">
                        <Trash2Icon />
                      </Button>
                    }
                    title="Excluir movimentação?"
                    description={`${c.amountCents > 0 ? "Aporte" : "Resgate"} de ${formatBRL(Math.abs(c.amountCents))} em ${formatDateBR(c.date)}.`}
                    confirmLabel="Excluir"
                    successMessage="Movimentação excluída"
                    onConfirm={() => deleteContribution(c.id)}
                  />
                </li>
              ))}
            </ul>
            {goal.contributions.length > HISTORY_PREVIEW ? (
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                Mostrando as {HISTORY_PREVIEW} movimentações mais recentes.
              </p>
            ) : null}
          </details>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum aporte ainda.</p>
        )}

        <div className="flex flex-wrap justify-end gap-1 border-t pt-3">
          <Button variant="ghost" size="sm" onClick={toggleArchived} disabled={pending}>
            {goal.archived ? <ArchiveRestoreIcon aria-hidden /> : <ArchiveIcon aria-hidden />}
            {goal.archived ? "Desarquivar" : "Arquivar"}
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2Icon aria-hidden /> Excluir
              </Button>
            }
            title={`Excluir a meta "${goal.name}"?`}
            description="O histórico de aportes e resgates também será apagado. Para só tirar da lista, arquive."
            confirmLabel="Excluir meta"
            confirmText={goal.contributions.length > 0 ? goal.name : undefined}
            successMessage="Meta excluída"
            onConfirm={() => deleteGoal(goal.id)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
