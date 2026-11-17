"use client";

import { Trash2Icon } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteSettlement } from "../actions";

export function DeleteSettlementButton({ id, label }: { id: string; label: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Excluir acerto: ${label}`}>
          <Trash2Icon />
        </Button>
      }
      title="Excluir acerto?"
      description={`${label}. Excluir faz a dívida voltar a contar esse valor.`}
      confirmLabel="Excluir"
      successMessage="Acerto excluído"
      onConfirm={() => deleteSettlement(id)}
    />
  );
}
