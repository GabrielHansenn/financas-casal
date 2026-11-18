"use client";

import { useState, useTransition, type ReactElement, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Confirmation dialog for destructive actions. Stays open while the action runs and shows a
 * toast with the result. With `confirmText`, the user must type it to enable the button.
 *
 * Opens from `trigger`, or is controlled with `open`/`onOpenChange` (e.g. from an ItemMenu).
 * `details` lists what will be lost (counts, linked records).
 * `onSuccess` replaces the default success toast (e.g. to show one with "Desfazer").
 */
export function ConfirmDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  title,
  description,
  details,
  confirmLabel,
  confirmText,
  successMessage,
  onConfirm,
  onSuccess,
}: {
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  details?: ReactNode;
  confirmLabel: string;
  confirmText?: string;
  successMessage?: string;
  onConfirm: () => Promise<Result>;
  onSuccess?: () => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  const canConfirm = !confirmText || typed.trim() === confirmText.trim();

  const confirm = () => {
    startTransition(async () => {
      const result = await onConfirm();
      if (result.ok) {
        if (onSuccess) onSuccess();
        else if (successMessage) toast.success(successMessage);
        setOpen(false);
        setTyped("");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      {trigger ? <AlertDialogTrigger render={trigger} /> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {details ? <div className="text-sm">{details}</div> : null}
        {confirmText ? (
          <div className="grid gap-1.5">
            <Label htmlFor="confirm-text">
              Digite <span className="font-semibold">{confirmText}</span> para confirmar
            </Label>
            <Input
              id="confirm-text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm} disabled={!canConfirm || pending}>
            {pending ? "Aguarde…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Bulleted list of what an action affects, for ConfirmDialog `details`. Empty lines are skipped. */
export function ImpactList({ items }: { items: (string | false | null | undefined)[] }) {
  const lines = items.filter((item): item is string => !!item);
  if (lines.length === 0) return null;
  return (
    <ul className="grid list-disc gap-1 rounded-lg bg-muted/60 py-2.5 pr-3 pl-7">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
