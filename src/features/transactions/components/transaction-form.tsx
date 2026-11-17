"use client";

import { ArrowRightIcon, TriangleAlertIcon } from "lucide-react";
import { useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import { Chip, Segmented } from "@/components/chip";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { computeSplits, SPLIT_ERROR_MESSAGES } from "@/lib/splits";
import { deleteTransaction, saveTransaction } from "../actions";
import {
  SPLIT_TYPE_LABELS,
  TRANSACTION_TYPE_LABELS,
  type QuickAddData,
  type SplitType,
  type TransactionDraft,
  type TransactionType,
} from "../types";

const LAST_ACCOUNT_KEY = (workspaceId: string) => `quick-add:last-account:${workspaceId}`;

function readLastAccount(workspaceId: string): string | null {
  try {
    return window.localStorage.getItem(LAST_ACCOUNT_KEY(workspaceId));
  } catch {
    return null; // storage unavailable (private mode, blocked)
  }
}

function writeLastAccount(workspaceId: string, accountId: string) {
  try {
    window.localStorage.setItem(LAST_ACCOUNT_KEY(workspaceId), accountId);
  } catch {
    // ignore
  }
}

/**
 * Create/edit form for transactions. Designed for the "3 taps" flow:
 * type the amount (keypad opens automatically), tap a category, tap Salvar.
 * Everything else has sensible defaults (expense, today, last used account, I paid, 50/50).
 */
export function TransactionForm({
  data,
  draft,
  onDone,
}: {
  data: QuickAddData;
  draft?: TransactionDraft;
  onDone: () => void;
}) {
  const isShared = data.workspaceType === "shared";
  const isEdit = !!draft;

  const [type, setType] = useState<TransactionType>(draft?.type ?? "expense");
  const [amountCents, setAmountCents] = useState(draft?.amountCents ?? 0);
  const [categoryId, setCategoryId] = useState<string | null>(draft?.categoryId ?? null);
  const [accountId, setAccountId] = useState<string>(() => {
    if (draft) return draft.accountId;
    const last = readLastAccount(data.workspaceId);
    return data.accounts.find((a) => a.id === last)?.id ?? data.accounts[0]?.id ?? "";
  });
  const [toAccountId, setToAccountId] = useState<string>(
    () => draft?.toAccountId ?? data.accounts.find((a) => a.id !== accountId)?.id ?? "",
  );
  const [date, setDate] = useState(draft?.date ?? data.today);
  const [description, setDescription] = useState(draft?.description ?? "");
  const [paidBy, setPaidBy] = useState(draft?.paidBy ?? data.currentUserId);
  const [splitType, setSplitType] = useState<SplitType>(
    draft ? draft.splitType : isShared ? "equal" : "none",
  );
  const [custom, setCustom] = useState<Record<string, number>>(draft?.customSplits ?? {});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const amountRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(
    () => data.categories.filter((c) => c.type === (type === "income" ? "income" : "expense")),
    [data.categories, type],
  );
  const canSplit = isShared && type === "expense";
  const yesterday = addDays(data.today, -1);
  const memberName = (userId: string) =>
    userId === data.currentUserId ? "Eu" : (data.members.find((m) => m.userId === userId)?.displayName ?? "?");

  // Live preview of the split, using the same function the server uses
  const preview = useMemo(() => {
    if (!canSplit || splitType === "none" || amountCents <= 0) return null;
    return computeSplits({
      amountCents,
      splitType,
      members: data.members.map((m) => ({ userId: m.userId, incomeCents: m.incomeCents })),
      payerId: paidBy,
      custom,
    });
  }, [canSplit, splitType, amountCents, data.members, paidBy, custom]);

  const customTotal = Object.values(custom).reduce((sum, v) => sum + v, 0);

  const changeType = (next: TransactionType) => {
    setType(next);
    setCategoryId(null);
    setError(null);
  };

  const changeSplitType = (next: SplitType) => {
    setSplitType(next);
    // Prefill custom amounts with an even split so the user only adjusts
    if (next === "custom" && amountCents > 0) {
      const even = computeSplits({
        amountCents,
        splitType: "equal",
        members: data.members.map((m) => ({ userId: m.userId, incomeCents: m.incomeCents })),
        payerId: paidBy,
      });
      if (even.ok) setCustom(Object.fromEntries(even.splits.map((s) => [s.userId, s.amountCents])));
    }
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);

    if (amountCents <= 0) {
      setError("Informe o valor.");
      amountRef.current?.focus();
      return;
    }
    if (!accountId) {
      setError("Crie uma conta antes de lançar (Mais → Contas).");
      return;
    }
    if (canSplit && splitType === "custom" && customTotal !== amountCents) {
      setError(SPLIT_ERROR_MESSAGES.custom_sum_mismatch);
      return;
    }

    startTransition(async () => {
      const result = await saveTransaction({
        id: draft?.id,
        workspaceId: data.workspaceId,
        type,
        amountCents,
        date,
        accountId,
        toAccountId: type === "transfer" ? toAccountId : null,
        categoryId: type === "transfer" ? null : categoryId,
        description: description.trim() || undefined,
        paidBy: type === "expense" ? paidBy : null,
        splitType: canSplit ? splitType : "none",
        customSplits: canSplit && splitType === "custom" ? custom : undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      writeLastAccount(data.workspaceId, accountId);
      const label = `${TRANSACTION_TYPE_LABELS[type]} de ${formatBRL(amountCents)}`;

      if (isEdit) {
        toast.success(`${label} atualizada`);
      } else {
        const id = result.id;
        toast.success(`${label} salva`, {
          action: {
            label: "Desfazer",
            onClick: async () => {
              const undo = await deleteTransaction(id);
              if (undo.ok) toast.success("Lançamento desfeito");
              else toast.error(undo.error);
            },
          },
        });
      }
      if (result.warning) toast.warning(result.warning, { duration: 8000 });
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <Segmented
        label="Tipo de lançamento"
        value={type}
        onChange={changeType}
        options={[
          { value: "expense", label: "Despesa" },
          { value: "income", label: "Receita" },
          { value: "transfer", label: "Transferência" },
        ]}
      />

      <div className="grid gap-1.5">
        <Label htmlFor="amount" className="sr-only">
          Valor
        </Label>
        <MoneyInput
          ref={amountRef}
          id="amount"
          size="hero"
          valueCents={amountCents}
          onValueChange={setAmountCents}
          autoFocus={!isEdit}
          aria-label="Valor"
          enterKeyHint="done"
        />
      </div>

      {type !== "transfer" ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Categoria</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Chip
                key={category.id}
                selected={categoryId === category.id}
                onClick={() => setCategoryId(categoryId === category.id ? null : category.id)}
                className="pl-1.5"
              >
                <CategoryIcon icon={category.icon} color={category.color} size="sm" />
                {category.name}
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : null}

      {data.accounts.length > 0 ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">{type === "transfer" ? "De" : "Conta"}</legend>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {data.accounts.map((account) => (
              <Chip key={account.id} selected={accountId === account.id} onClick={() => setAccountId(account.id)}>
                {account.name}
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : null}

      {type === "transfer" ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 flex items-center gap-1 text-sm font-medium">
            <ArrowRightIcon className="size-3.5" aria-hidden /> Para
          </legend>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {data.accounts
              .filter((account) => account.id !== accountId)
              .map((account) => (
                <Chip
                  key={account.id}
                  selected={toAccountId === account.id}
                  onClick={() => setToAccountId(account.id)}
                >
                  {account.name}
                </Chip>
              ))}
          </div>
          {data.accounts.length < 2 ? (
            <p className="text-sm text-muted-foreground">Crie uma segunda conta para fazer transferências.</p>
          ) : null}
        </fieldset>
      ) : null}

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Data</legend>
        <div className="flex flex-wrap items-center gap-2">
          <Chip selected={date === data.today} onClick={() => setDate(data.today)}>
            Hoje
          </Chip>
          <Chip selected={date === yesterday} onClick={() => setDate(yesterday)}>
            Ontem
          </Chip>
          <Input
            type="date"
            value={date}
            max="2100-12-31"
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-9 w-auto"
            aria-label="Escolher data"
          />
        </div>
      </fieldset>

      {canSplit ? (
        <div className="grid gap-4 rounded-lg border p-3">
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Quem pagou</legend>
            <div className="flex flex-wrap gap-2">
              {data.members.map((member) => (
                <Chip key={member.userId} selected={paidBy === member.userId} onClick={() => setPaidBy(member.userId)}>
                  {memberName(member.userId)}
                </Chip>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-2">
            <Label htmlFor="split-type">Divisão</Label>
            <select
              id="split-type"
              value={splitType}
              onChange={(e) => changeSplitType(e.target.value as SplitType)}
              className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            >
              {(["equal", "proportional", "custom", "none"] as const).map((option) => (
                <option key={option} value={option}>
                  {SPLIT_TYPE_LABELS[option]}
                </option>
              ))}
            </select>
            {splitType === "none" ? (
              <p className="text-xs text-muted-foreground">
                A despesa fica toda para {memberName(paidBy) === "Eu" ? "você" : memberName(paidBy)}; ninguém deve
                nada.
              </p>
            ) : null}
          </div>

          {splitType === "custom" ? (
            <div className="grid gap-2">
              {data.members.map((member) => (
                <div key={member.userId} className="flex items-center gap-3">
                  <span className="w-20 truncate text-sm">{memberName(member.userId)}</span>
                  <MoneyInput
                    className="flex-1"
                    valueCents={custom[member.userId] ?? 0}
                    onValueChange={(cents) => setCustom((prev) => ({ ...prev, [member.userId]: cents }))}
                    aria-label={`Parte de ${memberName(member.userId)}`}
                  />
                </div>
              ))}
              {amountCents > 0 && customTotal !== amountCents ? (
                <p className="text-xs text-destructive">
                  {customTotal < amountCents
                    ? `Faltam ${formatBRL(amountCents - customTotal)}`
                    : `Passou ${formatBRL(customTotal - amountCents)}`}
                </p>
              ) : null}
            </div>
          ) : null}

          {preview?.ok && splitType !== "custom" && preview.splits.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {preview.splits.map((s) => `${memberName(s.userId)} ${formatBRL(s.amountCents)}`).join(" · ")}
            </p>
          ) : null}
          {preview?.ok && preview.warning === "missing_income" ? (
            <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Falta a renda de alguém. Vai ficar meio a meio até vocês informarem em Workspaces.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="Ex.: Mercado do mês"
          autoComplete="off"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Salvar"}
      </Button>
    </form>
  );
}
