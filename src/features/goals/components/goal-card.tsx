"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  PencilIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog, ImpactList } from "@/components/confirm-dialog";
import { ItemMenu } from "@/components/item-menu";
import { toastWithUndo } from "@/components/undo-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateBR, formatMonthLabel } from "@/lib/dates";
import { formatBRL, formatSignedBRL } from "@/lib/money";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { deleteContribution, deleteGoal, saveContribution, setGoalArchived } from "../actions";
import type { ContributionInput } from "../schemas";
import { computeGoalProgress } from "../progress";
import type { GoalContribution, GoalItem } from "../types";
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
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const progress = computeGoalProgress({ ...goal, today });
  const who = (userId: string) => (userId === currentUserId ? "Você" : (memberNames[userId] ?? "Ex-membro"));

  const toggleArchived = () =>
    startTransition(async () => {
      const result = await setGoalArchived(goal.id, !goal.archived);
      if (result.ok) toast.success(goal.archived ? "Meta desarquivada" : "Meta arquivada");
      else toast.error(result.error);
    });

  return (
    // id: target of "Ver meta" links from the dreams board (/metas#goal-<id>)
    <Card id={`goal-${goal.id}`} className={cn("scroll-mt-20 target:ring-2 target:ring-primary", goal.archived && "opacity-75")}>
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
            {goal.dream ? (
              <Link
                href={`/sonhos/${goal.dream.id}`}
                className="flex w-fit items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
              >
                <SparklesIcon className="size-3.5" aria-hidden /> Sonho: {goal.dream.title}
              </Link>
            ) : null}
          </div>
          <ItemMenu
            label={`Ações da meta ${goal.name}`}
            className="-mt-2 -mr-2"
            actions={[
              { label: "Editar", icon: PencilIcon, onSelect: () => setDialog("edit") },
              goal.archived
                ? { label: "Desarquivar", icon: ArchiveRestoreIcon, onSelect: toggleArchived, disabled: pending }
                : { label: "Arquivar", icon: ArchiveIcon, onSelect: toggleArchived, disabled: pending },
              { label: "Excluir", icon: Trash2Icon, destructive: true, onSelect: () => setDialog("delete") },
            ]}
          />
          <GoalDialog
            workspaceId={workspaceId}
            today={today}
            goal={goal}
            open={dialog === "edit"}
            onOpenChange={(open) => !open && setDialog(null)}
          />
          <ConfirmDialog
            open={dialog === "delete"}
            onOpenChange={(open) => !open && setDialog(null)}
            title={`Excluir a meta "${goal.name}"?`}
            description="Isso não pode ser desfeito. Para só tirar da lista, arquive."
            details={
              <ImpactList
                items={[
                  goal.contributions.length > 0 &&
                    `${plural(goal.contributions.length, "movimentação", "movimentações")} do histórico (${formatBRL(goal.currentCents)} guardados) serão apagadas.`,
                  goal.dream?.status === "planning" && `O sonho "${goal.dream.title}" volta para Sonhando.`,
                  goal.dream?.status === "achieved" && `O sonho "${goal.dream.title}" continua como realizado.`,
                  "O saldo das contas não muda: metas não movimentam contas.",
                ]}
              />
            }
            confirmLabel="Excluir meta"
            confirmText={goal.contributions.length > 0 ? goal.name : undefined}
            successMessage="Meta excluída"
            onConfirm={() => deleteGoal(goal.id)}
          />
        </div>
        <GoalProgressBar fraction={progress.fraction} reached={progress.reached} label={`Progresso de ${goal.name}`} />
        <p className="text-xs text-muted-foreground">
          {progress.reached
            ? goal.dream?.status === "planning"
              ? "Meta alcançada! Abra o sonho para marcá-lo como realizado."
              : "Meta alcançada. Arquive quando não precisar mais acompanhar."
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
                <ContributionRow
                  key={c.id}
                  goal={goal}
                  contribution={c}
                  today={today}
                  who={who(c.createdBy)}
                />
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

      </CardContent>
    </Card>
  );
}

function ContributionRow({
  goal,
  contribution: c,
  today,
  who,
}: {
  goal: GoalItem;
  contribution: GoalContribution;
  today: string;
  /** "Você" or the member's name */
  who: string;
}) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const snapshot = useRef<ContributionInput | null>(null);
  const label = `${c.amountCents > 0 ? "Aporte" : "Resgate"} de ${formatBRL(Math.abs(c.amountCents))} em ${formatDateBR(c.date)}`;

  return (
    <li className="flex items-center gap-3 py-1 pr-1 pl-3">
      <span className="grid min-w-0 flex-1">
        <span className="text-sm">
          {who} {c.amountCents > 0 ? "aportou" : "resgatou"}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {formatDateBR(c.date)}
          {c.note ? ` · ${c.note}` : ""}
        </span>
      </span>
      <span className={cn("text-sm font-medium tabular-nums", c.amountCents > 0 && "text-emerald-600 dark:text-emerald-400")}>
        {formatSignedBRL(c.amountCents)}
      </span>
      <ItemMenu
        label={`Ações: ${label}`}
        actions={[
          !goal.archived && { label: "Editar", icon: PencilIcon, onSelect: () => setDialog("edit") },
          { label: "Excluir", icon: Trash2Icon, destructive: true, onSelect: () => setDialog("delete") },
        ]}
      />
      <ContributionDialog
        goal={goal}
        today={today}
        initialKind={c.amountCents < 0 ? "withdrawal" : "deposit"}
        contribution={c}
        open={dialog === "edit"}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Excluir movimentação?"
        description={`${label}.`}
        details={
          <ImpactList
            items={[
              c.amountCents > 0
                ? `A meta passa a ter ${formatBRL(goal.currentCents - c.amountCents)} guardados.`
                : `O valor volta para a meta, que passa a ter ${formatBRL(goal.currentCents - c.amountCents)}.`,
              "Você pode desfazer logo depois de excluir.",
            ]}
          />
        }
        confirmLabel="Excluir"
        onConfirm={async () => {
          const result = await deleteContribution(c.id);
          if (!result.ok) return result;
          snapshot.current = result.snapshot;
          return { ok: true };
        }}
        onSuccess={() => {
          const deleted = snapshot.current;
          if (deleted) toastWithUndo("Movimentação excluída", () => saveContribution(deleted), "Movimentação restaurada");
          else toast.success("Movimentação excluída");
        }}
      />
    </li>
  );
}
