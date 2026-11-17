"use client";

import { useRouter } from "next/navigation";
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
import { convertDreamToGoal } from "../actions";
import { conversionDefaults } from "../lifecycle";
import type { DreamItem } from "../types";

export function ConvertGoalDialog({ dream, today, trigger }: { dream: DreamItem; today: string; trigger: ReactElement }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transformar em meta</DialogTitle>
          <DialogDescription>
            A meta cuida da parte prática: quanto juntar e até quando. O progresso aparece no card do sonho.
          </DialogDescription>
        </DialogHeader>
        {open ? <ConvertForm dream={dream} today={today} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ConvertForm({ dream, today, onDone }: { dream: DreamItem; today: string; onDone: () => void }) {
  const router = useRouter();
  const defaults = conversionDefaults(dream);
  const [name, setName] = useState(defaults.name);
  const [targetCents, setTargetCents] = useState(defaults.targetCents);
  const [hasDeadline, setHasDeadline] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (targetCents <= 0) {
      setError("Informe quanto vocês precisam juntar.");
      return;
    }
    if (hasDeadline && !deadline) {
      setError("Escolha a data do prazo ou desmarque a opção.");
      return;
    }
    startTransition(async () => {
      const result = await convertDreamToGoal({
        dreamId: dream.id,
        name,
        targetCents,
        deadline: hasDeadline ? deadline : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Meta criada! Agora é registrar os aportes.", {
        action: { label: "Ver meta", onClick: () => router.push(`/metas#goal-${result.goalId}`) },
      });
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="convert-name">Nome da meta</Label>
        <Input id="convert-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="convert-target">Quanto juntar</Label>
        <MoneyInput id="convert-target" valueCents={targetCents} onValueChange={setTargetCents} autoFocus={targetCents === 0} />
        {dream.estimatedCostCents ? (
          <p className="text-xs text-muted-foreground">Preenchido com o custo estimado do sonho.</p>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasDeadline}
          onChange={(e) => setHasDeadline(e.target.checked)}
          className="size-4 accent-primary"
        />
        Definir um prazo
      </label>
      {hasDeadline ? (
        <Input
          type="date"
          value={deadline}
          min={today}
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
          {pending ? "Criando…" : "Criar meta"}
        </Button>
      </DialogFooter>
    </form>
  );
}
