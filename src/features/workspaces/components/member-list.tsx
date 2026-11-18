"use client";

import { CrownIcon, PencilIcon, UserMinusIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog, ImpactList } from "@/components/confirm-dialog";
import { ItemMenu } from "@/components/item-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { centsToDecimalString, formatBRL } from "@/lib/money";
import { removeMember, transferOwnership, updateMemberIncome } from "../actions";
import type { MemberDetail } from "../queries";

export function MemberList({
  workspaceId,
  members,
  viewerIsOwner,
}: {
  workspaceId: string;
  members: MemberDetail[];
  viewerIsOwner: boolean;
}) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Membros</p>
      <ul className="divide-y rounded-lg border">
        {members.map((member) => (
          <MemberRow
            key={member.userId}
            workspaceId={workspaceId}
            member={member}
            canEditIncome={member.isCurrentUser || viewerIsOwner}
            canRemove={viewerIsOwner && !member.isCurrentUser && member.role !== "owner"}
            canTransfer={viewerIsOwner && !member.isCurrentUser}
          />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        A renda mensal é usada na divisão proporcional das despesas. É visível para os membros do workspace.
      </p>
    </div>
  );
}

function MemberRow({
  workspaceId,
  member,
  canEditIncome,
  canRemove,
  canTransfer,
}: {
  workspaceId: string;
  member: MemberDetail;
  canEditIncome: boolean;
  canRemove: boolean;
  canTransfer: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<"remove" | "transfer" | null>(null);
  const [state, action, pending] = useActionState(
    async (prev: Awaited<ReturnType<typeof updateMemberIncome>>, formData: FormData) => {
      const result = await updateMemberIncome(prev, formData);
      if (result?.ok) {
        toast.success("Renda atualizada");
        setEditing(false);
      }
      return result;
    },
    null,
  );

  return (
    <li className="grid gap-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-medium">{member.displayName}</span>
          {member.isCurrentUser ? <Badge variant="secondary">Você</Badge> : null}
          {member.role === "owner" ? <Badge variant="outline">Dono</Badge> : null}
        </span>
        {!editing ? (
          <span className="text-sm text-muted-foreground tabular-nums">
            {member.incomeCents === null ? "Renda não informada" : formatBRL(member.incomeCents)}
          </span>
        ) : null}
        <ItemMenu
          label={`Ações de ${member.displayName}`}
          actions={[
            canEditIncome && !editing && { label: "Editar renda", icon: PencilIcon, onSelect: () => setEditing(true) },
            canTransfer && { label: "Tornar dono", icon: CrownIcon, onSelect: () => setDialog("transfer") },
            canRemove && {
              label: "Remover do workspace",
              icon: UserMinusIcon,
              destructive: true,
              onSelect: () => setDialog("remove"),
            },
          ]}
        />
        <ConfirmDialog
          open={dialog === "remove"}
          onOpenChange={(open) => !open && setDialog(null)}
          title={`Remover ${member.displayName}?`}
          description="A pessoa perde o acesso a este workspace."
          details={
            <ImpactList
              items={[
                "Os lançamentos dela continuam aqui, e o acerto do casal continua contando com ela.",
                "Contas e sonhos que eram dela passam a ser do casal.",
                "Recorrências pagas por ela são pausadas.",
              ]}
            />
          }
          confirmLabel="Remover"
          successMessage="Pessoa removida"
          onConfirm={() => removeMember(workspaceId, member.userId)}
        />
        <ConfirmDialog
          open={dialog === "transfer"}
          onOpenChange={(open) => !open && setDialog(null)}
          title={`Tornar ${member.displayName} dono do workspace?`}
          description="Você continua no workspace como membro."
          details={
            <ImpactList
              items={[
                `${member.displayName} passa a poder convidar, remover pessoas, renomear e excluir o workspace.`,
                "Depois disso, você pode sair do workspace se quiser.",
              ]}
            />
          }
          confirmLabel="Transferir"
          successMessage={`${member.displayName} agora é dono do workspace`}
          onConfirm={() => transferOwnership(workspaceId, member.userId)}
        />
      </div>

      {editing ? (
        <form action={action} className="grid gap-2">
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="userId" value={member.userId} />
          <div className="flex gap-2">
            <Input
              name="income"
              inputMode="decimal"
              placeholder="Renda mensal, ex.: 4.500,00"
              defaultValue={member.incomeCents === null ? "" : centsToDecimalString(member.incomeCents)}
              aria-label={`Renda mensal de ${member.displayName}`}
              autoFocus
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              Cancelar
            </Button>
          </div>
          {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        </form>
      ) : null}
    </li>
  );
}
