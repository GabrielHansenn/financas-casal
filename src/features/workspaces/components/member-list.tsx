"use client";

import { PencilIcon, UserMinusIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { centsToDecimalString, formatBRL } from "@/lib/money";
import { removeMember, updateMemberIncome } from "../actions";
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
}: {
  workspaceId: string;
  member: MemberDetail;
  canEditIncome: boolean;
  canRemove: boolean;
}) {
  const [editing, setEditing] = useState(false);
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
        {canEditIncome && !editing ? (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditing(true)}
            aria-label={`Editar renda de ${member.displayName}`}
          >
            <PencilIcon />
          </Button>
        ) : null}
        {canRemove ? (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Remover ${member.displayName}`}>
                <UserMinusIcon />
              </Button>
            }
            title={`Remover ${member.displayName}?`}
            description="A pessoa perde o acesso a este workspace. As transações já lançadas continuam aqui."
            confirmLabel="Remover"
            successMessage="Pessoa removida"
            onConfirm={() => removeMember(workspaceId, member.userId)}
          />
        ) : null}
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
