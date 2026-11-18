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
import { saveSettlement } from "../actions";
import type { SettlementRecord } from "../queries";

type Person = { userId: string; displayName: string; isMember?: boolean };

export function SettlementDialog({
  workspaceId,
  members,
  currentUserId,
  today,
  suggestion,
  settlement,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  workspaceId: string;
  /**
   * Members, plus former members who still have a balance here (isMember: false).
   * The database requires at least one side to be a current member.
   */
  members: Person[];
  currentUserId: string;
  today: string;
  /** Prefills the form with a suggested payment (the open debt) */
  suggestion?: Transfer;
  /** Existing settlement to edit */
  settlement?: SettlementRecord;
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
          <DialogTitle>{settlement ? "Editar acerto" : "Registrar acerto"}</DialogTitle>
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
            settlement={settlement}
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
  settlement,
  onDone,
}: {
  workspaceId: string;
  members: Person[];
  currentUserId: string;
  today: string;
  suggestion?: Transfer;
  settlement?: SettlementRecord;
  onDone: () => void;
}) {
  const other = (userId: string) => members.find((m) => m.userId !== userId)?.userId ?? "";
  const initialFrom = settlement?.fromUserId ?? suggestion?.fromUserId ?? currentUserId;
  const [fromUserId, setFromUserId] = useState(initialFrom);
  const [toUserId, setToUserId] = useState(settlement?.toUserId ?? suggestion?.toUserId ?? other(initialFrom));
  const [amountCents, setAmountCents] = useState(settlement?.amountCents ?? suggestion?.amountCents ?? 0);
  const [date, setDate] = useState(settlement?.date ?? today);
  const [note, setNote] = useState(settlement?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const name = (userId: string) => {
    if (userId === currentUserId) return "Você";
    const person = members.find((m) => m.userId === userId);
    if (!person) return "?";
    return person.isMember === false ? `${person.displayName} (saiu)` : person.displayName;
  };

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
      const result = await saveSettlement({
        id: settlement?.id,
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
      toast.success(settlement ? "Acerto atualizado" : `Acerto de ${formatBRL(amountCents)} registrado`);
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
          {pending ? "Salvando…" : settlement ? "Salvar alterações" : "Registrar acerto"}
        </Button>
      </DialogFooter>
    </form>
  );
}
