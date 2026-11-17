"use client";

import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import { Segmented } from "@/components/chip";
import { Button } from "@/components/ui/button";
import { setCategoryArchived } from "../actions";
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
          <CategoryRow key={category.id} category={category} workspaceId={workspaceId} />
        ))}
        {active.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">Nenhuma categoria ativa.</li>
        ) : null}
      </ul>

      {archived.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Arquivadas ({archived.length})
          </summary>
          <ul className="mt-3 divide-y rounded-xl border opacity-80">
            {archived.map((category) => (
              <CategoryRow key={category.id} category={category} workspaceId={workspaceId} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function CategoryRow({ category, workspaceId }: { category: ManagedCategory; workspaceId: string }) {
  const [pending, startTransition] = useTransition();

  const toggleArchived = () =>
    startTransition(async () => {
      const result = await setCategoryArchived(category.id, !category.archived);
      if (result.ok) toast.success(category.archived ? "Categoria restaurada" : "Categoria arquivada");
      else toast.error(result.error);
    });

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <CategoryIcon icon={category.icon} color={category.color} />
      <span className="flex-1 truncate font-medium">{category.name}</span>
      {!category.archived ? (
        <CategoryDialog
          workspaceId={workspaceId}
          category={category}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${category.name}`}>
              <PencilIcon />
            </Button>
          }
        />
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleArchived}
        disabled={pending}
        aria-label={category.archived ? `Restaurar ${category.name}` : `Arquivar ${category.name}`}
        title={category.archived ? "Restaurar" : "Arquivar (some dos lançamentos, mantém o histórico)"}
      >
        {category.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
      </Button>
    </li>
  );
}
