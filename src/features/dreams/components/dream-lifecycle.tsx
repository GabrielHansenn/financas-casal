"use client";

import { CameraIcon, PartyPopperIcon, RotateCcwIcon, TargetIcon } from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { removeDreamImage, setDreamImage, undoDreamAchieved } from "../actions";
import { ACCEPTED_IMAGE_TYPES } from "../board";
import { availableActions, shouldSuggestAchieved, statusAfterUndo } from "../lifecycle";
import { ImageError, uploadDreamImage } from "../image-upload";
import { DREAM_STATUS_LABELS } from "../labels";
import type { DreamItem } from "../types";
import { AchieveDialog } from "./achieve-dialog";
import { ConvertGoalDialog } from "./convert-goal-dialog";
import { DreamGoalProgress } from "./dream-goal-progress";

const longDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });

/** Status-driven section of the dream detail: dreaming -> planning (goal) -> achieved. */
export function DreamLifecycle({ dream, today }: { dream: DreamItem; today: string }) {
  const actions = availableActions(dream.status);
  const suggest = shouldSuggestAchieved(dream.status, dream.goal, today);
  const [pending, startTransition] = useTransition();
  const photoInput = useRef<HTMLInputElement>(null);

  const changeMomentPhoto = (file: File | undefined) => {
    if (!file) return;
    startTransition(async () => {
      try {
        const path = await uploadDreamImage(dream.workspaceId, dream.id, "achieved", file);
        const saved = await setDreamImage({ dreamId: dream.id, kind: "achieved", path });
        if (!saved.ok) throw new ImageError(saved.error);
        toast.success("Foto do momento salva");
      } catch (e) {
        toast.error(e instanceof ImageError ? e.message : "Não foi possível enviar a foto.");
      } finally {
        if (photoInput.current) photoInput.current.value = "";
      }
    });
  };

  return (
    <section aria-label="Etapa do sonho" className="grid gap-3">
      {dream.status === "achieved" && dream.achievedAt ? (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">
          <PartyPopperIcon className="size-5 shrink-0" aria-hidden />
          Realizado em {longDate.format(new Date(`${dream.achievedAt}T00:00:00Z`))}
        </div>
      ) : null}

      {dream.goal ? <DreamGoalProgress goal={dream.goal} status={dream.status} today={today} /> : null}
      {dream.status === "planning" && !dream.goal ? (
        <p className="text-sm text-muted-foreground">A meta vinculada não está disponível.</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {actions.includes("convert_to_goal") ? (
          <ConvertGoalDialog
            dream={dream}
            today={today}
            trigger={
              <Button>
                <TargetIcon aria-hidden /> Transformar em meta
              </Button>
            }
          />
        ) : null}
        {actions.includes("mark_achieved") ? (
          <AchieveDialog
            dream={dream}
            today={today}
            trigger={
              <Button variant={dream.status === "dreaming" && !suggest ? "outline" : "default"}>
                <PartyPopperIcon aria-hidden /> {dream.status === "dreaming" ? "Já realizamos!" : "Marcar como realizado"}
              </Button>
            }
          />
        ) : null}
        {dream.status === "achieved" ? (
          <>
            <Button variant="outline" onClick={() => photoInput.current?.click()} disabled={pending}>
              <CameraIcon aria-hidden /> {dream.achievedPath ? "Trocar foto do momento" : "Adicionar foto do momento"}
            </Button>
            <input
              ref={photoInput}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              className="sr-only"
              tabIndex={-1}
              aria-label="Escolher foto do momento"
              onChange={(e) => changeMomentPhoto(e.target.files?.[0])}
            />
            {dream.achievedPath ? (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const r = await removeDreamImage(dream.id, "achieved");
                    if (r.ok) toast.success("Foto do momento removida");
                    else toast.error(r.error);
                  })
                }
              >
                Remover foto
              </Button>
            ) : null}
          </>
        ) : null}
        {actions.includes("undo_achieved") ? (
          <ConfirmDialog
            trigger={
              <Button variant="ghost">
                <RotateCcwIcon aria-hidden /> Desfazer
              </Button>
            }
            title="Desfazer “realizado”?"
            description={`O sonho volta para "${DREAM_STATUS_LABELS[statusAfterUndo(dream.goalId)]}". A data e a foto do momento serão apagadas.`}
            confirmLabel="Desfazer"
            successMessage="O sonho voltou para o quadro"
            onConfirm={() => undoDreamAchieved(dream.id)}
          />
        ) : null}
      </div>
    </section>
  );
}
