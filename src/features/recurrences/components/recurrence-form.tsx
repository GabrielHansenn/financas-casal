"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import { Chip, Segmented } from "@/components/chip";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelpButton } from "@/features/help/components/help-button";
import { formatBRL } from "@/lib/money";
import { describeSchedule, MAX_OCCURRENCES_PER_RUN, type Frequency } from "@/lib/recurrence";
import { computeSplits } from "@/lib/splits";
import { SPLIT_TYPE_LABELS, type QuickAddData } from "@/features/transactions/types";
import { saveRecurrence } from "../actions";
import type { RecurrenceItem } from "../types";

type RecurrenceSplit = "none" | "equal" | "proportional";

export function RecurrenceForm({
  data,
  recurrence,
  onDone,
}: {
  data: QuickAddData;
  recurrence?: RecurrenceItem;
  onDone: () => void;
}) {
  const isShared = data.workspaceType === "shared";
  const isEdit = !!recurrence;

  const [type, setType] = useState<"expense" | "income">(recurrence?.type ?? "expense");
  const [amountCents, setAmountCents] = useState(recurrence?.amountCents ?? 0);
  const [description, setDescription] = useState(recurrence?.description ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(recurrence?.categoryId ?? null);
  const [accountId, setAccountId] = useState(recurrence?.accountId ?? data.accounts[0]?.id ?? "");
  const [frequency, setFrequency] = useState<Frequency>(recurrence?.frequency ?? "monthly");
  const [startDate, setStartDate] = useState(recurrence?.startDate ?? data.today);
  const [hasEnd, setHasEnd] = useState(!!recurrence?.endDate);
  const [endDate, setEndDate] = useState(recurrence?.endDate ?? "");
  const [paidBy, setPaidBy] = useState(recurrence?.paidBy ?? data.currentUserId);
  const [splitType, setSplitType] = useState<RecurrenceSplit>(
    recurrence ? recurrence.splitType : isShared ? "equal" : "none",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const categories = data.categories.filter((c) => c.type === type);
  const canSplit = isShared && type === "expense";
  const memberName = (userId: string) =>
    userId === data.currentUserId ? "Eu" : (data.members.find((m) => m.userId === userId)?.displayName ?? "?");

  const preview = useMemo(() => {
    if (!canSplit || splitType === "none" || amountCents <= 0) return null;
    return computeSplits({
      amountCents,
      splitType,
      members: data.members.map((m) => ({ userId: m.userId, incomeCents: m.incomeCents })),
      payerId: paidBy,
    });
  }, [canSplit, splitType, amountCents, data.members, paidBy]);

  const scheduleChanged = isEdit && (recurrence.startDate !== startDate || recurrence.frequency !== frequency);
  const backfills = !isEdit && startDate < data.today;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (amountCents <= 0) {
      setError("Informe o valor.");
      return;
    }
    if (!accountId) {
      setError("Crie uma conta antes (Mais → Contas).");
      return;
    }
    startTransition(async () => {
      const result = await saveRecurrence({
        id: recurrence?.id,
        workspaceId: data.workspaceId,
        type,
        amountCents,
        description: description.trim() || undefined,
        accountId,
        categoryId,
        paidBy: type === "expense" ? paidBy : null,
        splitType: canSplit ? splitType : "none",
        frequency,
        startDate,
        endDate: hasEnd && endDate ? endDate : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(isEdit ? "Recorrência atualizada" : "Recorrência criada");
      if (result.created > 0) {
        toast.success(
          result.created === 1 ? "1 lançamento gerado" : `${result.created} lançamentos gerados`,
        );
      }
      if (result.failed > 0) toast.warning("Não foi possível gerar um dos lançamentos. Confira quem paga e a divisão.");
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <Segmented
        label="Tipo"
        value={type}
        onChange={(next) => {
          setType(next);
          setCategoryId(null);
        }}
        options={[
          { value: "expense", label: "Despesa" },
          { value: "income", label: "Receita" },
        ]}
      />

      <div className="grid gap-1.5">
        <Label htmlFor="rec-amount">Valor</Label>
        <MoneyInput id="rec-amount" valueCents={amountCents} onValueChange={setAmountCents} autoFocus={!isEdit} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="rec-description">Descrição</Label>
        <Input
          id="rec-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder={type === "expense" ? "Ex.: Aluguel, Netflix" : "Ex.: Salário"}
          autoComplete="off"
        />
      </div>

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

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Conta</legend>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {data.accounts.map((account) => (
            <Chip key={account.id} selected={accountId === account.id} onClick={() => setAccountId(account.id)}>
              {account.name}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 rounded-lg border p-3">
        <Segmented
          label="Frequência"
          value={frequency}
          onChange={setFrequency}
          options={[
            { value: "weekly", label: "Semanal" },
            { value: "monthly", label: "Mensal" },
            { value: "yearly", label: "Anual" },
          ]}
        />
        <div className="grid gap-1.5">
          <Label htmlFor="rec-start">Primeiro lançamento</Label>
          <Input
            id="rec-start"
            type="date"
            value={startDate}
            max="2100-12-31"
            onChange={(e) => e.target.value && setStartDate(e.target.value)}
            className="w-auto"
          />
          <p className="text-xs text-muted-foreground">{describeSchedule(startDate, frequency)}</p>
          {backfills ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              A data já passou: os lançamentos desde então serão criados ao salvar (até {MAX_OCCURRENCES_PER_RUN} de
              uma vez).
            </p>
          ) : null}
          {scheduleChanged ? (
            <p className="text-xs text-muted-foreground">
              A nova programação vale a partir de hoje. Lançamentos já gerados não mudam.
            </p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasEnd}
            onChange={(e) => setHasEnd(e.target.checked)}
            className="size-4 accent-primary"
          />
          Tem data para terminar
        </label>
        {hasEnd ? (
          <Input
            type="date"
            value={endDate}
            min={startDate}
            max="2100-12-31"
            onChange={(e) => setEndDate(e.target.value)}
            className="w-auto"
            aria-label="Último lançamento até"
          />
        ) : null}
      </div>

      {canSplit ? (
        <div className="grid gap-4 rounded-lg border p-3">
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Quem paga</legend>
            <div className="flex flex-wrap gap-2">
              {data.members.map((member) => (
                <Chip key={member.userId} selected={paidBy === member.userId} onClick={() => setPaidBy(member.userId)}>
                  {memberName(member.userId)}
                </Chip>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="rec-split">Divisão</Label>
              <HelpButton topic="split" size="inline" />
            </div>
            <select
              id="rec-split"
              value={splitType}
              onChange={(e) => setSplitType(e.target.value as RecurrenceSplit)}
              className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
            >
              {(["equal", "proportional", "none"] as const).map((option) => (
                <option key={option} value={option}>
                  {SPLIT_TYPE_LABELS[option]}
                </option>
              ))}
            </select>
            {preview?.ok && preview.splits.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {preview.splits.map((s) => `${memberName(s.userId)} ${formatBRL(s.amountCents)}`).join(" · ")}
              </p>
            ) : null}
            {splitType === "proportional" ? (
              <p className="text-xs text-muted-foreground">
                Calculada com as rendas do momento de cada lançamento.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar recorrência"}
      </Button>
    </form>
  );
}
