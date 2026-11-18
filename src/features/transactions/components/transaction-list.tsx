"use client";

import { ArrowLeftRightIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import { ConfirmDialog, ImpactList } from "@/components/confirm-dialog";
import { ItemMenu } from "@/components/item-menu";
import { toastWithUndo } from "@/components/undo-toast";
import { Button } from "@/components/ui/button";
import { addDays, formatDateBR, formatDayLabel } from "@/lib/dates";
import { formatBRL, formatSignedBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { deleteTransaction, restoreTransaction } from "../actions";
import type { TransactionSnapshot } from "../schemas";
import { withArchivedOptions } from "../edit-data";
import { signedAmount, type DayGroup } from "../list";
import type { ListOptions, QuickAddData, SplitType, TransactionDraft, TransactionListItem } from "../types";
import { TransactionForm } from "./transaction-form";
import { TransactionSheet } from "./transaction-sheet";

const SPLIT_SHORT_LABELS: Record<Exclude<SplitType, "none">, string> = {
  equal: "meio a meio",
  proportional: "proporcional",
  custom: "personalizada",
};

function toDraft(tx: TransactionListItem): TransactionDraft {
  return {
    id: tx.id,
    type: tx.type,
    amountCents: tx.amountCents,
    date: tx.date,
    accountId: tx.accountId,
    toAccountId: tx.toAccountId,
    categoryId: tx.categoryId,
    description: tx.description,
    paidBy: tx.paidBy,
    splitType: tx.splitType,
    customSplits: Object.fromEntries(tx.splits.map((s) => [s.userId, s.amountCents])),
  };
}

function editDataFor(tx: TransactionListItem, data: QuickAddData, options: ListOptions): QuickAddData {
  return withArchivedOptions(data, options, {
    accountIds: [tx.accountId, tx.toAccountId],
    categoryId: tx.categoryId,
  });
}

export function TransactionList({
  groups,
  data,
  options,
  accountFilter,
}: {
  groups: DayGroup<TransactionListItem>[];
  data: QuickAddData;
  options: ListOptions;
  accountFilter: string | null;
}) {
  const [selected, setSelected] = useState<TransactionListItem | null>(null);
  // Keep the last selection rendered while the sheet animates closed
  const [open, setOpen] = useState(false);

  const accountName = (id: string | null) => options.accounts.find((a) => a.id === id)?.name ?? "Conta";
  const category = (id: string | null) => options.categories.find((c) => c.id === id);
  const yesterday = addDays(data.today, -1);
  const dayLabel = (date: string) =>
    date === data.today ? "Hoje" : date === yesterday ? "Ontem" : capitalize(formatDayLabel(date));
  const payerLabel = (tx: TransactionListItem) =>
    tx.paidBy === data.currentUserId ? "você" : (tx.payerName ?? "outra pessoa");

  const [toDelete, setToDelete] = useState<TransactionListItem | null>(null);
  const deletedSnapshot = useRef<TransactionSnapshot | null>(null);
  const isShared = data.workspaceType === "shared";
  const personLabel = (userId: string, name: string | null) =>
    userId === data.currentUserId ? "você" : (name ?? "outra pessoa");

  const openEdit = (tx: TransactionListItem) => {
    setSelected(tx);
    setOpen(true);
  };

  return (
    <>
      <div className="grid gap-6">
        {groups.map((group) => (
          <section key={group.date} aria-labelledby={`day-${group.date}`}>
            <header className="mb-1 flex items-baseline justify-between gap-4 px-1">
              <h2 id={`day-${group.date}`} className="text-sm font-medium text-muted-foreground">
                {dayLabel(group.date)}
              </h2>
              {group.totalCents !== 0 ? (
                <span className="text-xs text-muted-foreground tabular-nums">{formatSignedBRL(group.totalCents)}</span>
              ) : null}
            </header>
            <ul className="divide-y rounded-xl border bg-card">
              {group.items.map((tx) => {
                const cat = category(tx.categoryId);
                const signed = signedAmount(tx, accountFilter);
                const myShare = tx.splits.find((s) => s.userId === data.currentUserId)?.amountCents;
                const details: string[] = [
                  tx.type === "transfer"
                    ? `${accountName(tx.accountId)} → ${accountName(tx.toAccountId)}`
                    : accountName(tx.accountId),
                ];
                if (tx.description && cat) details.unshift(cat.name);
                if (data.workspaceType === "shared" && tx.type === "expense" && tx.paidBy) {
                  details.push(`pago por ${payerLabel(tx)}`);
                }

                return (
                  <li key={tx.id} className="flex items-center pr-1">
                    <button
                      type="button"
                      onClick={() => openEdit(tx)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-l-xl py-3 pr-1 pl-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {tx.type === "transfer" ? (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                          <ArrowLeftRightIcon className="size-4 text-muted-foreground" aria-hidden />
                        </span>
                      ) : (
                        <CategoryIcon icon={cat?.icon ?? "circle"} color={cat?.color ?? "#64748b"} />
                      )}
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="truncate font-medium">{titleOf(tx, cat?.name)}</span>
                        <span className="truncate text-xs text-muted-foreground">{details.join(" · ")}</span>
                        {tx.splitType !== "none" ? (
                          <span className="truncate text-xs text-muted-foreground">
                            Dividida {SPLIT_SHORT_LABELS[tx.splitType]}
                            {myShare !== undefined ? ` · sua parte ${formatBRL(myShare)}` : ""}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 font-medium tabular-nums",
                          signed > 0 && "text-emerald-600 dark:text-emerald-400",
                          signed === 0 && "text-muted-foreground",
                        )}
                      >
                        {signed === 0 ? formatBRL(tx.amountCents) : formatSignedBRL(signed)}
                      </span>
                    </button>
                    <ItemMenu
                      label={`Ações do lançamento ${titleOf(tx, cat?.name)}`}
                      actions={[
                        { label: "Editar", icon: PencilIcon, onSelect: () => openEdit(tx) },
                        { label: "Excluir", icon: Trash2Icon, destructive: true, onSelect: () => setToDelete(tx) },
                      ]}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <TransactionSheet
        open={open}
        onOpenChange={setOpen}
        title="Editar lançamento"
        description="Altere os dados do lançamento ou exclua."
      >
        {selected ? (
          <div className="grid gap-4">
            <TransactionForm
              key={selected.id}
              data={editDataFor(selected, data, options)}
              draft={toDraft(selected)}
              onDone={() => setOpen(false)}
            />
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setToDelete(selected)}
            >
              <Trash2Icon aria-hidden /> Excluir lançamento
            </Button>
          </div>
        ) : null}
      </TransactionSheet>

      {toDelete ? (
        <ConfirmDialog
          key={toDelete.id}
          open
          onOpenChange={(next) => !next && setToDelete(null)}
          title="Excluir lançamento?"
          description={`${titleOf(toDelete, category(toDelete.categoryId)?.name)} de ${formatBRL(toDelete.amountCents)} em ${formatDateBR(toDelete.date)}.`}
          details={
            <ImpactList
              items={[
                isShared && `Lançado por ${personLabel(toDelete.createdBy, toDelete.creatorName)}.`,
                toDelete.splitType !== "none" && "A divisão sai do acerto do casal, que é recalculado na hora.",
                "Você pode desfazer logo depois de excluir.",
              ]}
            />
          }
          confirmLabel="Excluir"
          onConfirm={async () => {
            const result = await deleteTransaction(toDelete.id);
            if (!result.ok) return result;
            deletedSnapshot.current = result.snapshot;
            return { ok: true };
          }}
          onSuccess={() => {
            setOpen(false);
            const snapshot = deletedSnapshot.current;
            if (snapshot) toastWithUndo("Lançamento excluído", () => restoreTransaction(snapshot), "Lançamento restaurado");
            else toast.success("Lançamento excluído");
          }}
        />
      ) : null}
    </>
  );
}

function titleOf(tx: TransactionListItem, categoryName: string | undefined): string {
  return tx.description || (tx.type === "transfer" ? "Transferência" : (categoryName ?? "Sem categoria"));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
