"use client";

import { CameraIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
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
import { markDreamAchieved, setDreamImage } from "../actions";
import { ACCEPTED_IMAGE_TYPES } from "../board";
import { celebrate } from "../celebrate";
import { ImageError, uploadDreamImage, validateImageFile } from "../image-upload";
import type { DreamItem } from "../types";

/** "Realizamos!": date (up to today) and an optional photo of the moment, then a small celebration. */
export function AchieveDialog({ dream, today, trigger }: { dream: DreamItem; today: string; trigger: ReactElement }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sonho realizado!</DialogTitle>
          <DialogDescription>
            Guarde a data e, se quiser, uma foto do momento. O sonho vai para o álbum de Sonhos realizados.
          </DialogDescription>
        </DialogHeader>
        {open ? <AchieveForm dream={dream} today={today} onDone={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AchieveForm({ dream, today, onDone }: { dream: DreamItem; today: string; onDone: () => void }) {
  const [date, setDate] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  const pick = (picked: File | undefined) => {
    if (!picked) return;
    try {
      validateImageFile(picked);
    } catch (e) {
      toast.error(e instanceof ImageError ? e.message : "Imagem inválida.");
      return;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(picked);
    setFile(picked);
    setPreview(objectUrl.current);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await markDreamAchieved({ dreamId: dream.id, achievedAt: date });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // The photo can only be linked once the dream is achieved (database rule)
      if (file) {
        try {
          const path = await uploadDreamImage(dream.workspaceId, dream.id, "achieved", file);
          const saved = await setDreamImage({ dreamId: dream.id, kind: "achieved", path });
          if (!saved.ok) throw new ImageError(saved.error);
        } catch (e) {
          toast.warning(`Sonho realizado, mas a foto não foi enviada. ${e instanceof ImageError ? e.message : ""}`);
        }
      }
      void celebrate();
      toast.success(`"${dream.title}" realizado! 🎉`);
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="achieved-date">Quando?</Label>
        <Input
          id="achieved-date"
          type="date"
          value={date}
          max={today}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="w-auto"
        />
      </div>
      <div className="grid gap-2">
        <span className="text-sm font-medium">Foto do momento (opcional)</span>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview
          <img src={preview} alt="Prévia da foto do momento" className="max-h-56 w-full rounded-xl border object-cover" />
        ) : null}
        <Button type="button" variant="outline" onClick={() => input.current?.click()} className="justify-self-start">
          <CameraIcon aria-hidden /> {preview ? "Trocar foto" : "Escolher foto"}
        </Button>
        <input
          ref={input}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label="Escolher foto do momento"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Marcar como realizado"}
        </Button>
      </DialogFooter>
    </form>
  );
}
