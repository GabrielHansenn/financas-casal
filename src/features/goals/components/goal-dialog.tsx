"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
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
import { saveGoal } from "../actions";
import type { GoalItem } from "../types";

export function GoalDialog({
  workspaceId,
  today,
  goal,
  trigger,
}: {
  workspaceId: string;
  today: string;
  goal?: GoalItem;
  trigger: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? "Editar meta" : "Nova meta"}</DialogTitle>
          <DialogDescription>
            Uma meta é um cofrinho: vocês registram quanto já guardaram até chegar no valor.
          </DialogDescription>
        </DialogHeader>
        {open ? <GoalForm workspaceId={workspaceId} today={today} goal={goal} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function GoalForm({
  workspaceId,
  today,
  goal,
  onDone,
}: {
  workspaceId: string;
  today: string;
  goal?: GoalItem;
  onDone: () => void;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [targetCents, setTargetCents] = useState(goal?.targetCents ?? 0);
  const [hasDeadline, setHasDeadline] = useState(!!goal?.deadline);
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (hasDeadline && !deadline) {
      setError("Escolha a data do prazo ou desmarque a opção.");
      return;
    }
    startTransition(async () => {
      const result = await saveGoal({
        id: goal?.id,
        workspaceId,
        name,
        targetCents,
        deadline: hasDeadline ? deadline : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(goal ? "Meta atualizada" : "Meta criada");
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="goal-name">Nome</Label>
        <Input
          id="goal-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Ex.: Viagem, Reserva de emergência"
          autoFocus
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="goal-target">Valor da meta</Label>
        <MoneyInput id="goal-target" valueCents={targetCents} onValueChange={setTargetCents} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasDeadline}
          onChange={(e) => setHasDeadline(e.target.checked)}
          className="size-4 accent-primary"
        />
        Tem prazo
      </label>
      {hasDeadline ? (
        <Input
          type="date"
          value={deadline}
          min={goal ? undefined : today}
          max="2100-12-31"
          onChange={(e) => setDeadline(e.target.value)}
          className="w-auto"
          aria-label="Prazo da meta"
        />
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
