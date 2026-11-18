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
import { saveContribution } from "../actions";
import type { GoalContribution, GoalItem } from "../types";

type Kind = "deposit" | "withdrawal";

export function ContributionDialog({
  goal,
  today,
  initialKind,
  contribution,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  goal: GoalItem;
  today: string;
  initialKind: Kind;
  /** Existing deposit/withdrawal to edit */
  contribution?: GoalContribution;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contribution ? `Editar movimentação · ${goal.name}` : goal.name}</DialogTitle>
          <DialogDescription>
            Guardado até agora: {formatBRL(goal.currentCents)} de {formatBRL(goal.targetCents)}. O registro não
            movimenta o saldo das contas.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ContributionForm
            goal={goal}
            today={today}
            initialKind={initialKind}
            contribution={contribution}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ContributionForm({
  goal,
  today,
  initialKind,
  contribution,
  onDone,
}: {
  goal: GoalItem;
  today: string;
  initialKind: Kind;
  contribution?: GoalContribution;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<Kind>(
    contribution ? (contribution.amountCents < 0 ? "withdrawal" : "deposit") : initialKind,
  );
  const [amountCents, setAmountCents] = useState(contribution ? Math.abs(contribution.amountCents) : 0);
  const [date, setDate] = useState(contribution?.date ?? today);
  const [note, setNote] = useState(contribution?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // When editing, the balance without this movement is what the new value applies to
  const baseCents = goal.currentCents - (contribution?.amountCents ?? 0);
  const tooMuch = kind === "withdrawal" && amountCents > baseCents;
  const remaining = Math.max(0, goal.targetCents - baseCents);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (amountCents <= 0) {
      setError("Informe o valor.");
      return;
    }
    if (tooMuch) {
      setError(`Não dá para resgatar mais do que tem na meta (${formatBRL(baseCents)}).`);
      return;
    }
    startTransition(async () => {
      const result = await saveContribution({
        id: contribution?.id,
        goalId: goal.id,
        kind,
        amountCents,
        date,
        note: note.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const after = baseCents + (kind === "deposit" ? amountCents : -amountCents);
      toast.success(
        contribution
          ? "Movimentação atualizada"
          : kind === "deposit"
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
            Disponível para resgate: {formatBRL(baseCents)}
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
          {pending ? "Salvando…" : contribution ? "Salvar alterações" : kind === "deposit" ? "Aportar" : "Resgatar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
