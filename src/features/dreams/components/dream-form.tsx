"use client";

import { ImagePlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/chip";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { removeDreamImage, saveDream, setDreamImage } from "../actions";
import { ACCEPTED_IMAGE_TYPES } from "../board";
import { ImageError, uploadDreamImage, validateImageFile } from "../image-upload";
import { DREAM_CATEGORIES, DREAM_HORIZONS, type DreamCategory, type DreamHorizon } from "../labels";
import type { DreamItem, DreamsBoardData } from "../types";

type BoardContext = Pick<DreamsBoardData, "workspaceId" | "workspaceType" | "currentUserId" | "members">;

/** Create/edit form. Only the title is required; everything else has a default. */
export function DreamForm({
  board,
  dream,
  onDone,
}: {
  board: BoardContext;
  dream?: DreamItem;
  onDone: (id: string) => void;
}) {
  const isShared = board.workspaceType === "shared";
  const [title, setTitle] = useState(dream?.title ?? "");
  const [category, setCategory] = useState<DreamCategory>(dream?.category ?? "other");
  const [horizon, setHorizon] = useState<DreamHorizon>(dream?.horizon ?? "someday");
  const [ownerUserId, setOwnerUserId] = useState<string | null>(dream ? dream.ownerUserId : null);
  const [costCents, setCostCents] = useState(dream?.estimatedCostCents ?? 0);
  const [why, setWhy] = useState(dream?.why ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(dream?.coverUrl ?? null);
  const [removeCover, setRemoveCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);

  // Revoke the local preview URL when the form unmounts
  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  const pickFile = (picked: File | undefined) => {
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
    setRemoveCover(false);
  };

  const clearCover = () => {
    setFile(null);
    setPreview(null);
    setRemoveCover(!!dream?.coverPath);
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveDream({
        id: dream?.id,
        workspaceId: board.workspaceId,
        title,
        why: why.trim() || undefined,
        category,
        horizon,
        ownerUserId: isShared ? ownerUserId : board.currentUserId,
        estimatedCostCents: costCents > 0 ? costCents : null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      // The dream exists now (its id names the storage folder), so the image can be uploaded
      if (file) {
        try {
          const path = await uploadDreamImage(result.workspaceId, result.id, "cover", file);
          const saved = await setDreamImage({ dreamId: result.id, kind: "cover", path });
          if (!saved.ok) throw new ImageError(saved.error);
        } catch (e) {
          toast.warning(`Sonho salvo, mas a imagem não foi enviada. ${e instanceof ImageError ? e.message : ""}`);
        }
      } else if (removeCover && dream) {
        await removeDreamImage(dream.id, "cover");
      }

      toast.success(dream ? "Sonho atualizado" : "Sonho adicionado ao quadro");
      onDone(result.id);
    });
  };

  const ownerOptions: { value: string | null; label: string }[] = [
    { value: null, label: "Nosso" },
    { value: board.currentUserId, label: "Meu" },
    ...board.members
      .filter((m) => m.userId !== board.currentUserId)
      .map((m) => ({ value: m.userId, label: `De ${m.displayName}` })),
  ];

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="dream-title">Qual é o sonho?</Label>
        <Input
          id="dream-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="Ex.: Conhecer o Japão"
          autoFocus={!dream}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium">Imagem</span>
        {preview ? (
          <div className="relative overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview / signed URL */}
            <img src={preview} alt="Prévia da imagem do sonho" className="max-h-64 w-full object-cover" />
            <div className="absolute right-2 bottom-2 flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
                Trocar
              </Button>
              <Button type="button" size="icon-sm" variant="secondary" onClick={clearCover} aria-label="Remover imagem">
                <Trash2Icon />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex h-28 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <ImagePlusIcon className="size-6" aria-hidden />
            Adicionar uma foto que represente o sonho
            <span className="text-xs">JPG, PNG ou WEBP, até 5 MB</span>
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-label="Escolher imagem do sonho"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Categoria</legend>
        <div className="flex flex-wrap gap-2">
          {DREAM_CATEGORIES.map(({ value, label, icon: Icon, color }) => (
            <Chip key={value} selected={category === value} onClick={() => setCategory(value)}>
              <Icon className="size-4" style={category === value ? undefined : { color }} aria-hidden />
              {label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Quando?</legend>
        <div className="flex flex-wrap gap-2">
          {DREAM_HORIZONS.map(({ value, label, hint }) => (
            <Chip key={value} selected={horizon === value} onClick={() => setHorizon(value)} title={hint}>
              {label}
            </Chip>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{DREAM_HORIZONS.find((h) => h.value === horizon)?.hint}</p>
      </fieldset>

      {isShared ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">De quem é o sonho?</legend>
          <div className="flex flex-wrap gap-2">
            {ownerOptions.map((option) => (
              <Chip
                key={option.value ?? "ours"}
                selected={ownerUserId === option.value}
                onClick={() => setOwnerUserId(option.value)}
              >
                {option.label}
              </Chip>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="dream-cost">Custo estimado (opcional)</Label>
        <MoneyInput id="dream-cost" valueCents={costCents} onValueChange={setCostCents} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="dream-why">Por que esse sonho importa? (opcional)</Label>
        <Textarea
          id="dream-why"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Ex.: Para comemorarmos 10 anos juntos."
        />
        <span className="justify-self-end text-xs text-muted-foreground tabular-nums">{why.length}/280</span>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? "Salvando…" : dream ? "Salvar alterações" : "Adicionar ao quadro"}
      </Button>
    </form>
  );
}
