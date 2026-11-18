"use client";

import { toast } from "sonner";

type Result = { ok: true } | { ok: false; error: string };

export const UNDO_TOAST_DURATION_MS = 6000;

/** Success toast with a "Desfazer" button that runs `undo` (e.g. recreating a deleted record). */
export function toastWithUndo(message: string, undo: () => Promise<Result>, undoneMessage: string) {
  toast.success(message, {
    duration: UNDO_TOAST_DURATION_MS,
    action: {
      label: "Desfazer",
      onClick: async () => {
        const result = await undo();
        if (result.ok) toast.success(undoneMessage);
        else toast.error(result.error);
      },
    },
  });
}
