"use client";

import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import { Segmented } from "@/components/chip";
import { ConfirmDialog, ImpactList } from "@/components/confirm-dialog";
import { ItemMenu } from "@/components/item-menu";
import { ReassignDeleteDialog } from "@/components/reassign-delete-dialog";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/plural";
import { deleteCategory, getCategoryUsage, setCategoryArchived, type CategoryUsage } from "../actions";
import type { ManagedCategory } from "../queries";
import { CategoryDialog } from "./category-dialog";

export function CategoryList({ workspaceId, categories }: { workspaceId: string; categories: ManagedCategory[] }) {
  const [type, setType] = useState<ManagedCategory["type"]>("expense");
  const ofType = categories.filter((c) => c.type === type);
  const active = ofType.filter((c) => !c.archived);
  const archived = ofType.filter((c) => c.archived);

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <Segmented
          className="flex-1"
          label="Tipo"
          value={type}
          onChange={setType}
          options={[
            { value: "expense", label: "Despesas" },
            { value: "income", label: "Receitas" },
          ]}
        />
        <CategoryDialog
          workspaceId={workspaceId}
          defaultType={type}
          trigger={
            <Button>
              <PlusIcon aria-hidden />
              Nova
            </Button>
          }
        />
      </div>

      <ul className="divide-y rounded-xl border">
        {active.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            workspaceId={workspaceId}
            otherActive={active.filter((c) => c.id !== category.id)}
          />
        ))}
        {active.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma categoria ativa de {type === "expense" ? "despesa" : "receita"}. Toque em Nova para criar.
          </li>
        ) : null}
      </ul>

      {archived.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Arquivadas ({archived.length})
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Categorias arquivadas não aparecem nos lançamentos, mas o histórico continua.
          </p>
          <ul className="mt-3 divide-y rounded-xl border opacity-80">
            {archived.map((category) => (
              <CategoryRow key={category.id} category={category} workspaceId={workspaceId} otherActive={active} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function CategoryRow({
  category,
  workspaceId,
  otherActive,
}: {
  category: ManagedCategory;
  workspaceId: string;
  /** Active categories of the same type that can receive this category's records */
  otherActive: ManagedCategory[];
}) {
  const [dialog, setDialog] = useState<"edit" | "archive" | "delete" | null>(null);
  const [usage, setUsage] = useState<CategoryUsage | null>(null);
  const [pending, startTransition] = useTransition();

  const needsUsage = dialog === "archive" || dialog === "delete";
  useEffect(() => {
    if (!needsUsage) return;
    let cancelled = false;
    getCategoryUsage(category.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setUsage(result.usage);
      else {
        toast.error(result.error);
        setDialog(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [needsUsage, category.id]);

  const closeDialog = () => {
    setDialog(null);
    setUsage(null);
  };

  const restore = () =>
    startTransition(async () => {
      const result = await setCategoryArchived(category.id, false);
      if (result.ok) toast.success("Categoria restaurada");
      else toast.error(result.error);
    });

  const linked = usage
    ? [
        usage.transactions > 0 && plural(usage.transactions, "lançamento", "lançamentos"),
        usage.recurrences > 0 && plural(usage.recurrences, "recorrência", "recorrências"),
      ].filter((line): line is string => !!line)
    : null;

  return (
    <li className="flex items-center gap-3 py-1 pr-1 pl-4 sm:py-1.5">
      <CategoryIcon icon={category.icon} color={category.color} />
      <span className="flex-1 truncate font-medium">{category.name}</span>
      <ItemMenu
        label={`Ações da categoria ${category.name}`}
        actions={[
          !category.archived && { label: "Editar", icon: PencilIcon, onSelect: () => setDialog("edit") },
          category.archived
            ? { label: "Restaurar", icon: ArchiveRestoreIcon, onSelect: restore, disabled: pending }
            : { label: "Arquivar", icon: ArchiveIcon, onSelect: () => setDialog("archive") },
          { label: "Excluir", icon: Trash2Icon, destructive: true, onSelect: () => setDialog("delete") },
        ]}
      />

      <CategoryDialog
        workspaceId={workspaceId}
        category={category}
        open={dialog === "edit"}
        onOpenChange={(open) => !open && closeDialog()}
      />

      <ConfirmDialog
        open={dialog === "archive"}
        onOpenChange={(open) => !open && closeDialog()}
        title={`Arquivar "${category.name}"?`}
        description="Você pode restaurar a categoria quando quiser, em Arquivadas."
        details={
          usage ? (
            <ImpactList
              items={[
                "Ela some dos seletores de lançamento. O histórico continua.",
                usage.activeRecurrences > 0 &&
                  plural(usage.activeRecurrences, "recorrência ativa será pausada", "recorrências ativas serão pausadas"),
              ]}
            />
          ) : (
            <p className="text-muted-foreground">Carregando…</p>
          )
        }
        confirmLabel="Arquivar"
        successMessage="Categoria arquivada"
        onConfirm={() => setCategoryArchived(category.id, true)}
      />

      <ReassignDeleteDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && closeDialog()}
        title={`Excluir "${category.name}"?`}
        noun="a categoria"
        linked={linked}
        targets={[
          ...otherActive.map((c) => ({ value: c.id, label: c.name })),
          { value: "", label: "Deixar sem categoria" },
        ]}
        archiveHint={
          category.archived
            ? "Ela já está arquivada. Manter assim preserva o histórico."
            : "Some dos seletores; o histórico continua com esta categoria."
        }
        onArchive={async () => (category.archived ? { ok: true } : setCategoryArchived(category.id, true))}
        onDelete={(target) => deleteCategory(category.id, target)}
        onError={(message) => toast.error(message)}
        onSuccess={(message) => toast.success(message)}
      />
    </li>
  );
}
