"use client";

import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import { setAccountArchived } from "../actions";
import type { AccountType, ManagedAccount } from "../queries";
import { AccountDialog } from "./account-dialog";

const TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão de crédito",
  cash: "Dinheiro",
};

export function AccountList({
  workspaceId,
  accounts,
  members,
}: {
  workspaceId: string;
  accounts: ManagedAccount[];
  members: { userId: string; displayName: string }[];
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
          <li className="p-6 text-center text-sm text-muted-foreground">Nenhuma conta ativa. Crie uma para lançar.</li>
        ) : null}
        {active.map((account) => (
          <AccountRow
            key={account.id}
            account={account}
            subtitle={[TYPE_LABELS[account.type], ownerName(account.ownerUserId)].filter(Boolean).join(" · ")}
            workspaceId={workspaceId}
            members={members}
          />
        ))}
      </ul>

      {archived.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Arquivadas ({archived.length})
          </summary>
          <ul className="mt-3 divide-y rounded-xl border opacity-80">
            {archived.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                subtitle={TYPE_LABELS[account.type]}
                workspaceId={workspaceId}
                members={members}
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
}: {
  account: ManagedAccount;
  subtitle: string;
  workspaceId: string;
  members: { userId: string; displayName: string }[];
}) {
  const [pending, startTransition] = useTransition();

  const toggleArchived = () =>
    startTransition(async () => {
      const result = await setAccountArchived(account.id, !account.archived);
      if (result.ok) toast.success(account.archived ? "Conta restaurada" : "Conta arquivada");
      else toast.error(result.error);
    });

  return (
    <li className="flex items-center gap-3 px-4 py-3">
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
      {!account.archived ? (
        <AccountDialog
          workspaceId={workspaceId}
          members={members}
          account={account}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${account.name}`}>
              <PencilIcon />
            </Button>
          }
        />
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleArchived}
        disabled={pending}
        aria-label={account.archived ? `Restaurar ${account.name}` : `Arquivar ${account.name}`}
        title={account.archived ? "Restaurar" : "Arquivar (some dos lançamentos, mantém o histórico)"}
      >
        {account.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
      </Button>
    </li>
  );
}
