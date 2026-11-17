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
import { formatBRL } from "@/lib/money";
import { addContribution } from "../actions";
import type { GoalItem } from "../types";

type Kind = "deposit" | "withdrawal";

export function ContributionDialog({
  goal,
  today,
  initialKind,
  trigger,
}: {
  goal: GoalItem;
  today: string;
  initialKind: Kind;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal.name}</DialogTitle>
          <DialogDescription>
            Guardado até agora: {formatBRL(goal.currentCents)} de {formatBRL(goal.targetCents)}. O registro não
            movimenta o saldo das contas.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ContributionForm goal={goal} today={today} initialKind={initialKind} onDone={() => setOpen(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ContributionForm({
  goal,
  today,
  initialKind,
  onDone,
}: {
  goal: GoalItem;
  today: string;
  initialKind: Kind;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [amountCents, setAmountCents] = useState(0);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tooMuch = kind === "withdrawal" && amountCents > goal.currentCents;
  const remaining = Math.max(0, goal.targetCents - goal.currentCents);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (amountCents <= 0) {
      setError("Informe o valor.");
      return;
    }
    if (tooMuch) {
      setError(`Não dá para resgatar mais do que tem na meta (${formatBRL(goal.currentCents)}).`);
      return;
    }
    startTransition(async () => {
      const result = await addContribution({ goalId: goal.id, kind, amountCents, date, note: note.trim() || undefined });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const after = goal.currentCents + (kind === "deposit" ? amountCents : -amountCents);
      toast.success(
        kind === "deposit"
          ? after >= goal.targetCents
            ? `Meta "${goal.name}" alcançada!`
            : `Aporte de ${formatBRL(amountCents)} registrado`
          : `Resgate de ${formatBRL(amountCents)} registrado`,
      );
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Segmented
        label="Tipo de movimentação"
        value={kind}
        onChange={setKind}
        options={[
          { value: "deposit", label: "Aportar" },
          { value: "withdrawal", label: "Resgatar" },
        ]}
      />
      <div className="grid gap-1.5">
        <Label htmlFor="contribution-amount">Valor</Label>
        <MoneyInput id="contribution-amount" valueCents={amountCents} onValueChange={setAmountCents} autoFocus />
        {kind === "deposit" && remaining > 0 ? (
          <button
            type="button"
            onClick={() => setAmountCents(remaining)}
            className="justify-self-start text-xs text-primary underline-offset-4 hover:underline"
          >
            Completar a meta ({formatBRL(remaining)})
          </button>
        ) : null}
        {kind === "withdrawal" ? (
          <p className={tooMuch ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            Disponível para resgate: {formatBRL(goal.currentCents)}
          </p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="contribution-date">Data</Label>
        <Input
          id="contribution-date"
          type="date"
          value={date}
          max="2100-12-31"
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-auto"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="contribution-note">Observação (opcional)</Label>
        <Input
          id="contribution-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder={kind === "deposit" ? "Ex.: 13º salário" : "Ex.: Passagens"}
          autoComplete="off"
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="submit" disabled={pending || tooMuch}>
          {pending ? "Salvando…" : kind === "deposit" ? "Aportar" : "Resgatar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
