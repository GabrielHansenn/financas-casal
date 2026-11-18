"use client";

import { CalendarClockIcon, PauseIcon, PencilIcon, PlayIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import { ConfirmDialog, ImpactList } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { ItemMenu } from "@/components/item-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { describeSchedule, isFinished } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import { TransactionSheet } from "@/features/transactions/components/transaction-sheet";
import { withArchivedOptions } from "@/features/transactions/edit-data";
import { SPLIT_TYPE_LABELS, type ListOptions, type QuickAddData } from "@/features/transactions/types";
import { deleteRecurrence, setRecurrencePaused } from "../actions";
import type { RecurrenceItem } from "../types";
import { RecurrenceForm } from "./recurrence-form";

type Status = "active" | "paused" | "finished";

function statusOf(r: RecurrenceItem): Status {
  if (isFinished(r)) return "finished";
  return r.active ? "active" : "paused";
}

const SECTIONS: { status: Status; title: string }[] = [
  { status: "active", title: "Ativas" },
  { status: "paused", title: "Pausadas" },
  { status: "finished", title: "Encerradas" },
];

export function RecurrenceList({
  recurrences,
  data,
  options,
}: {
  recurrences: RecurrenceItem[];
  data: QuickAddData;
  options: ListOptions;
}) {
  // null = closed, "new" = create, otherwise the recurrence being edited
  const [editing, setEditing] = useState<RecurrenceItem | "new" | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const category = (id: string | null) => options.categories.find((c) => c.id === id);
  const accountName = (id: string) => options.accounts.find((a) => a.id === id)?.name ?? "Conta";
  const payerName = (id: string | null) =>
    id === data.currentUserId ? "você" : (data.members.find((m) => m.userId === id)?.displayName ?? "ex-membro");

  const [toDelete, setToDelete] = useState<RecurrenceItem | null>(null);
  // Archiving an account/category pauses its recurrences; say so on the badge
  const archivedReason = (r: RecurrenceItem) => {
    if (options.accounts.find((a) => a.id === r.accountId)?.archived) return "conta arquivada";
    if (r.categoryId && options.categories.find((c) => c.id === r.categoryId)?.archived) return "categoria arquivada";
    return null;
  };

  const show = (target: RecurrenceItem | "new") => {
    setEditing(target);
    setOpen(true);
  };

  const togglePaused = (r: RecurrenceItem) =>
    startTransition(async () => {
      const result = await setRecurrencePaused(r.id, r.active);
      if (result.ok) {
        toast.success(r.active ? "Recorrência pausada" : "Recorrência retomada");
        setOpen(false);
      } else toast.error(result.error);
    });

  const selected = editing && editing !== "new" ? editing : null;

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button onClick={() => show("new")} disabled={data.accounts.length === 0}>
          <PlusIcon aria-hidden /> Nova recorrência
        </Button>
      </div>

      {recurrences.length === 0 ? (
        <EmptyState
          icon={CalendarClockIcon}
          title="Nenhuma recorrência"
          description="Cadastre contas fixas como aluguel, internet, assinaturas e salário. Elas são lançadas sozinhas na data certa."
        />
      ) : (
        <div className="grid gap-6">
          {SECTIONS.map(({ status, title }) => {
            const items = recurrences.filter((r) => statusOf(r) === status);
            if (items.length === 0) return null;
            return (
              <section key={status} aria-labelledby={`rec-${status}`}>
                <h2 id={`rec-${status}`} className="mb-1 px-1 text-sm font-medium text-muted-foreground">
                  {title}
                </h2>
                <ul className="divide-y rounded-xl border bg-card">
                  {items.map((r) => {
                    const cat = category(r.categoryId);
                    const details = [describeSchedule(r.startDate, r.frequency), accountName(r.accountId)];
                    if (data.workspaceType === "shared" && r.type === "expense" && r.splitType !== "none") {
                      details.push(`${payerName(r.paidBy)} paga · ${SPLIT_TYPE_LABELS[r.splitType].toLowerCase()}`);
                    }
                    const pausedBecause = archivedReason(r);
                    return (
                      <li key={r.id} className="flex items-center pr-1">
                        <button
                          type="button"
                          onClick={() => show(r)}
                          className={cn(
                            "flex min-w-0 flex-1 items-center gap-3 rounded-l-xl py-3 pr-1 pl-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                            status !== "active" && "opacity-70",
                          )}
                        >
                          <CategoryIcon icon={cat?.icon ?? "repeat"} color={cat?.color ?? "#64748b"} />
                          <span className="grid min-w-0 flex-1 gap-0.5">
                            <span className="truncate font-medium">
                              {titleOf(r, cat?.name)}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">{details.join(" · ")}</span>
                            <span className="text-xs text-muted-foreground">
                              {status === "active" ? (
                                `Próximo: ${formatDateBR(r.nextDate)}`
                              ) : status === "paused" ? (
                                <Badge variant="secondary">
                                  {pausedBecause ? `Pausada · ${pausedBecause}` : "Pausada"}
                                </Badge>
                              ) : (
                                `Terminou em ${formatDateBR(r.endDate!)}`
                              )}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 font-medium tabular-nums",
                              r.type === "income" && "text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {r.type === "income" ? "+" : "-"}
                            {formatBRL(r.amountCents)}
                          </span>
                        </button>
                        <ItemMenu
                          label={`Ações da recorrência ${titleOf(r, cat?.name)}`}
                          actions={[
                            { label: "Editar", icon: PencilIcon, onSelect: () => show(r) },
                            status !== "finished" &&
                              (r.active
                                ? { label: "Pausar", icon: PauseIcon, onSelect: () => togglePaused(r), disabled: pending }
                                : { label: "Retomar", icon: PlayIcon, onSelect: () => togglePaused(r), disabled: pending }),
                            { label: "Excluir", icon: Trash2Icon, destructive: true, onSelect: () => setToDelete(r) },
                          ]}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <TransactionSheet
        open={open}
        onOpenChange={setOpen}
        title={selected ? "Editar recorrência" : "Nova recorrência"}
        description="Valor, categoria, conta e quando o lançamento se repete."
      >
        {editing === "new" ? (
          <RecurrenceForm data={data} onDone={() => setOpen(false)} />
        ) : selected ? (
          <div className="grid gap-4">
            <RecurrenceForm
              key={selected.id}
              data={withArchivedOptions(data, options, {
                accountIds: [selected.accountId],
                categoryId: selected.categoryId,
              })}
              recurrence={selected}
              onDone={() => setOpen(false)}
            />
            {statusOf(selected) !== "finished" ? (
              <Button variant="outline" onClick={() => togglePaused(selected)} disabled={pending}>
                {selected.active ? (
                  <>
                    <PauseIcon aria-hidden /> Pausar
                  </>
                ) : (
                  <>
                    <PlayIcon aria-hidden /> Retomar
                  </>
                )}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setToDelete(selected)}
            >
              <Trash2Icon aria-hidden /> Excluir recorrência
            </Button>
          </div>
        ) : null}
      </TransactionSheet>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(next) => !next && setToDelete(null)}
        title="Excluir recorrência?"
        description={toDelete ? `${titleOf(toDelete)} de ${formatBRL(toDelete.amountCents)}, ${describeSchedule(toDelete.startDate, toDelete.frequency).toLowerCase()}.` : ""}
        details={
          <ImpactList
            items={[
              "Ela para de gerar lançamentos.",
              "Os lançamentos já criados por ela continuam na lista de transações.",
              "Se quiser só interromper por um tempo, use Pausar.",
            ]}
          />
        }
        confirmLabel="Excluir"
        successMessage="Recorrência excluída"
        onConfirm={async () => {
          if (!toDelete) return { ok: false, error: "Recorrência não encontrada." };
          const result = await deleteRecurrence(toDelete.id);
          if (result.ok) setOpen(false);
          return result;
        }}
      />
    </>
  );
}

function titleOf(r: RecurrenceItem, categoryName?: string): string {
  return r.description || categoryName || (r.type === "income" ? "Receita" : "Despesa");
}
