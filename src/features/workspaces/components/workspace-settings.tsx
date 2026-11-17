"use client";

import { LogOutIcon, Trash2Icon } from "lucide-react";
import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteWorkspace, leaveWorkspace, renameWorkspace, switchWorkspace } from "../actions";

export function RenameWorkspaceForm({ workspaceId, name }: { workspaceId: string; name: string }) {
  const [state, action, pending] = useActionState(renameWorkspace, null);

  useEffect(() => {
    if (state?.ok) toast.success("Nome atualizado");
    else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="flex gap-2">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <Input name="name" defaultValue={name} maxLength={80} aria-label="Nome do workspace" required />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Salvando…" : "Renomear"}
      </Button>
    </form>
  );
}

export function UseWorkspaceButton({ workspaceId }: { workspaceId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await switchWorkspace(workspaceId);
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      Usar este
    </Button>
  );
}

export function LeaveWorkspaceButton({ workspaceId, name }: { workspaceId: string; name: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <LogOutIcon aria-hidden />
          Sair do workspace
        </Button>
      }
      title={`Sair de "${name}"?`}
      description="Você perde o acesso às transações deste workspace. Para voltar, alguém precisa te convidar de novo."
      confirmLabel="Sair"
      successMessage="Você saiu do workspace"
      onConfirm={() => leaveWorkspace(workspaceId)}
    />
  );
}

export function DeleteWorkspaceButton({ workspaceId, name }: { workspaceId: string; name: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2Icon aria-hidden />
          Excluir workspace
        </Button>
      }
      title={`Excluir "${name}"?`}
      description="Todas as contas, transações, acertos, recorrências e metas deste workspace serão apagados para todos os membros. Isso não pode ser desfeito."
      confirmLabel="Excluir para sempre"
      confirmText={name}
      successMessage="Workspace excluído"
      onConfirm={() => deleteWorkspace(workspaceId)}
    />
  );
}
