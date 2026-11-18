"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, ImpactList } from "@/components/confirm-dialog";
import { ItemMenu } from "@/components/item-menu";
import { toastWithUndo } from "@/components/undo-toast";
import { deleteSettlement, saveSettlement } from "../actions";
import type { SettlementRecord } from "../queries";
import type { SettlementInput } from "../schemas";
import { SettlementDialog } from "./settlement-dialog";

type Person = { userId: string; displayName: string; isMember?: boolean };

/** "⋯" menu of a settlement in the history: edit, or delete with "Desfazer". */
export function SettlementMenu({
  settlement,
  label,
  workspaceId,
  people,
  currentUserId,
  today,
}: {
  settlement: SettlementRecord;
  /** "Você pagou R$ 50,00 para Ana" */
  label: string;
  workspaceId: string;
  people: Person[];
  currentUserId: string;
  today: string;
}) {
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const snapshot = useRef<SettlementInput | null>(null);

  return (
    <>
      <ItemMenu
        label={`Ações do acerto: ${label}`}
        actions={[
          { label: "Editar", icon: PencilIcon, onSelect: () => setDialog("edit") },
          { label: "Excluir", icon: Trash2Icon, destructive: true, onSelect: () => setDialog("delete") },
        ]}
      />
      <SettlementDialog
        workspaceId={workspaceId}
        members={people}
        currentUserId={currentUserId}
        today={today}
        settlement={settlement}
        open={dialog === "edit"}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title="Excluir acerto?"
        description={`${label}.`}
        details={
          <ImpactList
            items={[
              "Esse valor volta a contar como dívida no acerto do casal.",
              "Você pode desfazer logo depois de excluir.",
            ]}
          />
        }
        confirmLabel="Excluir"
        onConfirm={async () => {
          const result = await deleteSettlement(settlement.id);
          if (!result.ok) return result;
          snapshot.current = result.snapshot;
          return { ok: true };
        }}
        onSuccess={() => {
          const deleted = snapshot.current;
          if (deleted) toastWithUndo("Acerto excluído", () => saveSettlement(deleted), "Acerto restaurado");
          else toast.success("Acerto excluído");
        }}
      />
    </>
  );
}
