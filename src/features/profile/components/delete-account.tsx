"use client";

import { UserXIcon } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog, ImpactList } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteMyAccount, getAccountDeletionPreview, type AccountDeletionPreview } from "../actions";
import { DELETE_ACCOUNT_CONFIRMATION } from "../constants";

export function DeleteAccount() {
  const [preview, setPreview] = useState<AccountDeletionPreview | null>(null);

  const load = async (open: boolean) => {
    if (!open) return;
    const result = await getAccountDeletionPreview();
    if (result.ok) setPreview(result.preview);
  };

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Apaga sua conta e seus dados pessoais do Adois. Isso não pode ser desfeito.
      </p>
      <ConfirmDialog
        onOpenChange={load}
        trigger={
          <Button variant="outline" className="justify-self-start text-destructive hover:text-destructive">
            <UserXIcon aria-hidden /> Excluir minha conta
          </Button>
        }
        title="Excluir sua conta?"
        description="Isto é o que acontece:"
        details={
          preview ? (
            <ImpactList
              items={[
                "Seu workspace pessoal é apagado, com contas, lançamentos, metas, sonhos e fotos.",
                ...preview.deletedShared.map(
                  (name) => `"${name}" é apagado, porque só você faz parte dele.`,
                ),
                ...preview.kept.map((w) =>
                  w.newOwner
                    ? `"${w.name}" continua para ${w.newOwner}, que passa a ser dono. Seus lançamentos lá ficam, com o nome "Ex-membro", para o acerto continuar certo.`
                    : `"${w.name}" continua. Seus lançamentos lá ficam, com o nome "Ex-membro", para o acerto continuar certo.`,
                ),
                "Seu nome, email e login são apagados. Você sai do app em seguida.",
              ]}
            />
          ) : (
            <p className="text-muted-foreground">Verificando seus workspaces…</p>
          )
        }
        confirmLabel="Excluir minha conta"
        confirmText={DELETE_ACCOUNT_CONFIRMATION}
        onConfirm={() => deleteMyAccount(DELETE_ACCOUNT_CONFIRMATION)}
      />
    </div>
  );
}
