"use client";

import { useState, useTransition } from "react";
import { ImpactList } from "@/components/confirm-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };
export type ReassignTarget = { value: string; label: string };

/**
 * Delete flow for records other rows depend on (accounts, categories):
 * - nothing linked: plain confirmation;
 * - something linked: (a) archive instead, or (b) move the linked rows to a chosen target and delete.
 * The parent loads the usage (`linked` = null while loading) and runs the actions.
 */
export function ReassignDeleteDialog({
  open,
  onOpenChange,
  title,
  noun,
  linked,
  targets,
  targetNote,
  archiveHint,
  onArchive,
  onDelete,
  onError,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Feminine noun with article, used in sentences: "a conta" / "a categoria" */
  noun: string;
  /** What depends on the record; empty = nothing; null = still loading */
  linked: string[] | null;
  /** Where linked rows can go. A target with value "" means "no target" (e.g. no category). */
  targets: ReassignTarget[];
  /** Extra consequence of choosing a given target (e.g. transfers that will be deleted) */
  targetNote?: (target: string) => string | null;
  archiveHint: string;
  onArchive: () => Promise<Result>;
  onDelete: (target: string | null) => Promise<Result>;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}) {
  const [mode, setMode] = useState<"archive" | "move">("archive");
  const [target, setTarget] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const loading = linked === null;
  const hasLinks = !loading && linked.length > 0;
  const selectedTarget = target ?? targets[0]?.value ?? null;
  const canMove = targets.length > 0;
  const note = hasLinks && mode === "move" && selectedTarget !== null ? targetNote?.(selectedTarget) : null;

  const close = (next: boolean) => {
    if (pending) return;
    onOpenChange(next);
    if (!next) {
      setMode("archive");
      setTarget(null);
    }
  };

  const confirm = () => {
    startTransition(async () => {
      let result: Result;
      let message: string;
      if (!hasLinks) {
        result = await onDelete(null);
        message = `${capitalize(noun)} foi excluída`;
      } else if (mode === "archive") {
        result = await onArchive();
        message = `${capitalize(noun)} foi arquivada`;
      } else {
        result = await onDelete(selectedTarget);
        message = `Lançamentos movidos e ${noun} excluída`;
      }
      if (result.ok) {
        onSuccess(message);
        close(false);
      } else {
        onError(result.error);
      }
    });
  };

  const confirmLabel = !hasLinks ? "Excluir" : mode === "archive" ? "Arquivar" : "Mover e excluir";

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {loading
              ? "Verificando o que depende dela…"
              : hasLinks
                ? `Não dá para excluir ${noun} direto, porque ela tem:`
                : `Nenhum lançamento ou recorrência usa ${noun}. Ela será excluída para sempre.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {loading ? <Skeleton className="h-16 w-full" /> : null}
        {hasLinks ? (
          <div className="grid gap-4 text-sm">
            <ImpactList items={linked} />
            <fieldset className="grid gap-2">
              <legend className="mb-1 font-medium">O que você quer fazer?</legend>
              <ChoiceCard
                checked={mode === "archive"}
                onSelect={() => setMode("archive")}
                title={`Arquivar ${noun} (recomendado)`}
                hint={archiveHint}
              />
              <ChoiceCard
                checked={mode === "move"}
                onSelect={() => setMode("move")}
                disabled={!canMove}
                title={`Mover os lançamentos e excluir ${noun}`}
                hint={canMove ? "Os lançamentos passam para o destino que você escolher." : "Não há outro destino disponível."}
              />
            </fieldset>
            {mode === "move" && canMove ? (
              <div className="grid gap-1.5">
                <Label htmlFor="reassign-target">Mover para</Label>
                <select
                  id="reassign-target"
                  value={selectedTarget ?? ""}
                  onChange={(e) => setTarget(e.target.value)}
                  className="h-11 rounded-lg border border-input bg-transparent px-2 text-sm sm:h-9 dark:bg-input/30"
                >
                  {targets.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {note ? <p className="text-xs text-amber-700 dark:text-amber-400">{note}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant={hasLinks && mode === "archive" ? "default" : "destructive"}
            onClick={confirm}
            disabled={loading || pending}
          >
            {pending ? "Aguarde…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ChoiceCard({
  checked,
  onSelect,
  title,
  hint,
  disabled,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        checked && "border-primary bg-primary/5",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input
        type="radio"
        name="reassign-mode"
        checked={checked}
        onChange={onSelect}
        disabled={disabled}
        className="mt-0.5 size-4 accent-primary"
      />
      <span className="grid gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
