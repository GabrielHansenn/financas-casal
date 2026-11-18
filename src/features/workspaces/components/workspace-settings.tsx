"use client";

import { LogOutIcon, Trash2Icon } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog, ImpactList } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { plural } from "@/lib/plural";
import {
  deleteWorkspace,
  getWorkspaceUsage,
  leaveWorkspace,
  renameWorkspace,
  switchWorkspace,
  type WorkspaceUsage,
} from "../actions";

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
      description="Você perde o acesso a este workspace. Para voltar, alguém precisa te convidar de novo."
      details={
        <ImpactList
          items={[
            "Os lançamentos que você fez continuam aqui, e o acerto do casal continua contando com você.",
            "Contas e sonhos que eram seus passam a ser do casal.",
            "Recorrências pagas por você são pausadas.",
          ]}
        />
      }
      confirmLabel="Sair"
      successMessage="Você saiu do workspace"
      onConfirm={() => leaveWorkspace(workspaceId)}
    />
  );
}

export function DeleteWorkspaceButton({ workspaceId, name }: { workspaceId: string; name: string }) {
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);

  const loadUsage = async (open: boolean) => {
    if (!open) return;
    const result = await getWorkspaceUsage(workspaceId);
    if (result.ok) setUsage(result.usage);
  };

  return (
    <ConfirmDialog
      onOpenChange={loadUsage}
      details={
        usage ? (
          <ImpactList
            items={[
              usage.transactions > 0 && plural(usage.transactions, "lançamento", "lançamentos"),
              usage.accounts > 0 && plural(usage.accounts, "conta", "contas"),
              usage.categories > 0 && plural(usage.categories, "categoria", "categorias"),
              usage.recurrences > 0 && plural(usage.recurrences, "recorrência", "recorrências"),
              usage.goals > 0 && plural(usage.goals, "meta com seus aportes", "metas com seus aportes"),
              usage.dreams > 0 && plural(usage.dreams, "sonho com suas fotos", "sonhos com suas fotos"),
              "todos os acertos entre vocês",
              usage.members > 1 && `${plural(usage.members - 1, "pessoa perde", "pessoas perdem")} o acesso`,
            ]}
          />
        ) : (
          <p className="text-muted-foreground">Contando o que será apagado…</p>
        )
      }
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2Icon aria-hidden />
          Excluir workspace
        </Button>
      }
      title={`Excluir "${name}"?`}
      description="Isto apaga, para todos os membros e para sempre:"
      confirmLabel="Excluir para sempre"
      confirmText={name}
      successMessage="Workspace excluído"
      onConfirm={() => deleteWorkspace(workspaceId)}
    />
  );
}
