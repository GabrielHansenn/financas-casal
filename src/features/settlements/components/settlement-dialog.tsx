"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/chip";
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
import type { Transfer } from "@/lib/settlement";
import { createSettlement } from "../actions";

type Person = { userId: string; displayName: string };

export function SettlementDialog({
  workspaceId,
  members,
  currentUserId,
  today,
  suggestion,
  trigger,
}: {
  workspaceId: string;
  /** Current members only: the database rejects settlements with former members */
  members: Person[];
  currentUserId: string;
  today: string;
  /** Prefills the form with a suggested payment (the open debt) */
  suggestion?: Transfer;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar acerto</DialogTitle>
          <DialogDescription>
            Anote um pagamento entre vocês (Pix, dinheiro…). Ele abate a dívida, mas não mexe no saldo das contas.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <SettlementForm
            workspaceId={workspaceId}
            members={members}
            currentUserId={currentUserId}
            today={today}
            suggestion={suggestion}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SettlementForm({
  workspaceId,
  members,
  currentUserId,
  today,
  suggestion,
  onDone,
}: {
  workspaceId: string;
  members: Person[];
  currentUserId: string;
  today: string;
  suggestion?: Transfer;
  onDone: () => void;
}) {
  const other = (userId: string) => members.find((m) => m.userId !== userId)?.userId ?? "";
  const [fromUserId, setFromUserId] = useState(suggestion?.fromUserId ?? currentUserId);
  const [toUserId, setToUserId] = useState(suggestion?.toUserId ?? other(suggestion?.fromUserId ?? currentUserId));
  const [amountCents, setAmountCents] = useState(suggestion?.amountCents ?? 0);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const name = (userId: string) =>
    userId === currentUserId ? "Você" : (members.find((m) => m.userId === userId)?.displayName ?? "?");

  const changeFrom = (userId: string) => {
    setFromUserId(userId);
    if (toUserId === userId) setToUserId(other(userId));
  };

  // Paying more than the open debt in the same direction flips who owes
  const overpay =
    suggestion && suggestion.fromUserId === fromUserId && suggestion.toUserId === toUserId
      ? amountCents - suggestion.amountCents
      : 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (amountCents <= 0) {
      setError("Informe o valor.");
      return;
    }
    startTransition(async () => {
      const result = await createSettlement({
        workspaceId,
        fromUserId,
        toUserId,
        amountCents,
        date,
        note: note.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Acerto de ${formatBRL(amountCents)} registrado`);
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Quem pagou</legend>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <Chip key={m.userId} selected={fromUserId === m.userId} onClick={() => changeFrom(m.userId)}>
              {name(m.userId)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Para quem</legend>
        <div className="flex flex-wrap gap-2">
          {members
            .filter((m) => m.userId !== fromUserId)
            .map((m) => (
              <Chip key={m.userId} selected={toUserId === m.userId} onClick={() => setToUserId(m.userId)}>
                {name(m.userId)}
              </Chip>
            ))}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor="settlement-amount">Valor</Label>
        <MoneyInput id="settlement-amount" valueCents={amountCents} onValueChange={setAmountCents} autoFocus />
        {suggestion && amountCents > 0 && overpay < 0 ? (
          <p className="text-xs text-muted-foreground">
            Acerto parcial: ainda ficam {formatBRL(-overpay)} em aberto.
          </p>
        ) : null}
        {overpay > 0 ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Valor {formatBRL(overpay)} acima da dívida: depois disso, quem deve passa a ser {name(toUserId)}.
          </p>
        ) : null}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="settlement-date">Data</Label>
        <Input
          id="settlement-date"
          type="date"
          value={date}
          max="2100-12-31"
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-auto"
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="settlement-note">Observação (opcional)</Label>
        <Input
          id="settlement-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="Ex.: Pix do mês"
          autoComplete="off"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={pending || !toUserId}>
          {pending ? "Salvando…" : "Registrar acerto"}
        </Button>
      </DialogFooter>
    </form>
  );
}
