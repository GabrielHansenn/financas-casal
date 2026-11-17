"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { Segmented } from "@/components/chip";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAccount } from "../actions";
import type { AccountType, ManagedAccount } from "../queries";

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Conta corrente" },
  { value: "savings", label: "Poupança" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "cash", label: "Dinheiro" },
];

export function AccountDialog({
  workspaceId,
  members,
  account,
  trigger,
}: {
  workspaceId: string;
  /** Members of a shared workspace (empty for personal), to choose the account owner */
  members: { userId: string; displayName: string }[];
  account?: ManagedAccount;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>
            Contas são onde o dinheiro está: conta corrente, poupança, cartão ou dinheiro vivo.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <AccountForm workspaceId={workspaceId} members={members} account={account} onDone={() => setOpen(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AccountForm({
  workspaceId,
  members,
  account,
  onDone,
}: {
  workspaceId: string;
  members: { userId: string; displayName: string }[];
  account?: ManagedAccount;
  onDone: () => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "checking");
  const [balanceCents, setBalanceCents] = useState(Math.abs(account?.initialBalanceCents ?? 0));
  const [negative, setNegative] = useState((account?.initialBalanceCents ?? 0) < 0);
  const [ownerUserId, setOwnerUserId] = useState<string>(account?.ownerUserId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveAccount({
        id: account?.id,
        workspaceId,
        name,
        type,
        initialBalanceCents: negative ? -balanceCents : balanceCents,
        ownerUserId: ownerUserId || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(account ? "Conta atualizada" : "Conta criada");
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="account-name">Nome</Label>
        <Input
          id="account-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Ex.: Nubank, Carteira"
          autoFocus
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="account-type">Tipo</Label>
        <select
          id="account-type"
          value={type}
          onChange={(e) => setType(e.target.value as AccountType)}
          className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="account-balance">Saldo inicial</Label>
        <MoneyInput id="account-balance" valueCents={balanceCents} onValueChange={setBalanceCents} />
        <Segmented
          label="Sinal do saldo inicial"
          value={negative ? "negative" : "positive"}
          onChange={(value) => setNegative(value === "negative")}
          options={[
            { value: "positive", label: "Tenho esse valor" },
            { value: "negative", label: "Devo esse valor" },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          O saldo atual é o saldo inicial mais as receitas, menos as despesas e transferências.
        </p>
      </div>

      {members.length > 1 ? (
        <div className="grid gap-1.5">
          <Label htmlFor="account-owner">De quem é</Label>
          <select
            id="account-owner"
            value={ownerUserId}
            onChange={(e) => setOwnerUserId(e.target.value)}
            className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          >
            <option value="">Conjunta</option>
            {members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.displayName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
