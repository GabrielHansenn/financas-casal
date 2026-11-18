"use client";

import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog, ImpactList } from "@/components/confirm-dialog";
import { ItemMenu } from "@/components/item-menu";
import { ReassignDeleteDialog } from "@/components/reassign-delete-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { deleteAccount, getAccountUsage, setAccountArchived, type AccountUsage } from "../actions";
import type { AccountType, ManagedAccount } from "../queries";
import { AccountDialog } from "./account-dialog";

const TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão de crédito",
  cash: "Dinheiro",
};

type Members = { userId: string; displayName: string }[];

export function AccountList({
  workspaceId,
  accounts,
  members,
}: {
  workspaceId: string;
  accounts: ManagedAccount[];
  members: Members;
}) {
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const ownerName = (id: string | null) => (id ? members.find((m) => m.userId === id)?.displayName : null);

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <AccountDialog
          workspaceId={workspaceId}
          members={members}
          trigger={
            <Button>
              <PlusIcon aria-hidden />
              Nova conta
            </Button>
          }
        />
      </div>

      <ul className="divide-y rounded-xl border">
        {active.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">
            Você ainda não tem contas ativas. Crie uma para começar a lançar.
          </li>
        ) : null}
        {active.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            subtitle={[TYPE_LABELS[account.type], ownerName(account.ownerUserId)].filter(Boolean).join(" · ")}
            workspaceId={workspaceId}
            members={members}
            otherActive={active.filter((a) => a.id !== account.id)}
          />
        ))}
      </ul>

      {archived.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Arquivadas ({archived.length})
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Contas arquivadas não aparecem nos lançamentos, mas o histórico e o saldo continuam contando.
          </p>
          <ul className="mt-3 divide-y rounded-xl border opacity-80">
            {archived.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                subtitle={TYPE_LABELS[account.type]}
                workspaceId={workspaceId}
                members={members}
                otherActive={active}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function AccountRow({
  account,
  subtitle,
  workspaceId,
  members,
  otherActive,
}: {
  account: ManagedAccount;
  subtitle: string;
  workspaceId: string;
  members: Members;
  /** Active accounts that can receive this account's records */
  otherActive: ManagedAccount[];
}) {
  const [dialog, setDialog] = useState<"edit" | "archive" | "delete" | null>(null);
  const [usage, setUsage] = useState<AccountUsage | null>(null);
  const [pending, startTransition] = useTransition();

  // Load what depends on the account when a dialog that explains it opens
  const needsUsage = dialog === "archive" || dialog === "delete";
  useEffect(() => {
    if (!needsUsage) return;
    let cancelled = false;
    getAccountUsage(account.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setUsage(result.usage);
      else {
        toast.error(result.error);
        setDialog(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [needsUsage, account.id]);

  const closeDialog = () => {
    setDialog(null);
    setUsage(null);
  };

  const restore = () =>
    startTransition(async () => {
      const result = await setAccountArchived(account.id, false);
      if (result.ok) toast.success("Conta restaurada");
      else toast.error(result.error);
    });

  const archiveDetails = usage ? (
    <ImpactList
      items={[
        "Ela some das listas e dos seletores de lançamento. O histórico continua.",
        usage.balanceCents !== 0 &&
          `O saldo de ${formatBRL(usage.balanceCents)} continua contando no saldo total do início.`,
        usage.activeRecurrences > 0 &&
          plural(usage.activeRecurrences, "recorrência ativa será pausada", "recorrências ativas serão pausadas"),
      ]}
    />
  ) : (
    <p className="text-muted-foreground">Carregando…</p>
  );

  const linked = usage
    ? [
        usage.transactions > 0 && plural(usage.transactions, "lançamento", "lançamentos"),
        usage.recurrences > 0 && plural(usage.recurrences, "recorrência", "recorrências"),
      ].filter((line): line is string => !!line)
    : null;

  const targetNote = (target: string) => {
    if (!usage) return null;
    const notes: string[] = [];
    const transfers = usage.transfersWith[target] ?? 0;
    if (transfers > 0) {
      notes.push(
        `${plural(transfers, "transferência entre as duas contas será apagada", "transferências entre as duas contas serão apagadas")}, porque virariam uma transferência da conta para ela mesma.`,
      );
    }
    if (usage.initialBalanceCents !== 0) {
      notes.push(`O saldo inicial de ${formatBRL(usage.initialBalanceCents)} não é transferido.`);
    }
    return notes.length > 0 ? notes.join(" ") : null;
  };

  return (
    <li className="flex items-center gap-2 py-1 pr-1 pl-4 sm:gap-3 sm:py-2">
      <span className="grid min-w-0 flex-1">
        <span className="flex items-center gap-2 truncate font-medium">
          {account.name}
          {account.archived ? <Badge variant="secondary">Arquivada</Badge> : null}
        </span>
        <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span className={cn("text-sm tabular-nums", account.balanceCents < 0 && "text-destructive")}>
        {formatBRL(account.balanceCents)}
      </span>
      <ItemMenu
        label={`Ações da conta ${account.name}`}
        actions={[
          !account.archived && { label: "Editar", icon: PencilIcon, onSelect: () => setDialog("edit") },
          account.archived
            ? { label: "Restaurar", icon: ArchiveRestoreIcon, onSelect: restore, disabled: pending }
            : { label: "Arquivar", icon: ArchiveIcon, onSelect: () => setDialog("archive") },
          { label: "Excluir", icon: Trash2Icon, destructive: true, onSelect: () => setDialog("delete") },
        ]}
      />

      <AccountDialog
        workspaceId={workspaceId}
        members={members}
        account={account}
        open={dialog === "edit"}
        onOpenChange={(open) => !open && closeDialog()}
      />

      <ConfirmDialog
        open={dialog === "archive"}
        onOpenChange={(open) => !open && closeDialog()}
        title={`Arquivar "${account.name}"?`}
        description="Você pode restaurar a conta quando quiser, em Arquivadas."
        details={archiveDetails}
        confirmLabel="Arquivar"
        successMessage="Conta arquivada"
        onConfirm={() => setAccountArchived(account.id, true)}
      />

      <ReassignDeleteDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && closeDialog()}
        title={`Excluir "${account.name}"?`}
        noun="a conta"
        linked={linked}
        targets={otherActive.map((a) => ({ value: a.id, label: a.name }))}
        targetNote={targetNote}
        archiveHint={
          account.archived
            ? "Ela já está arquivada. Manter assim preserva o histórico."
            : "Some das listas e seletores; o histórico e o saldo continuam."
        }
        onArchive={async () => (account.archived ? { ok: true } : setAccountArchived(account.id, true))}
        onDelete={(target) => deleteAccount(account.id, target)}
        onError={(message) => toast.error(message)}
        onSuccess={(message) => toast.success(message)}
      />
    </li>
  );
}
