"use client";

import { CheckIcon } from "lucide-react";
import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon } from "@/components/category-icon";
import { Segmented } from "@/components/chip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { saveCategory } from "../actions";
import type { ManagedCategory } from "../queries";

type CategoryType = ManagedCategory["type"];

export function CategoryDialog({
  workspaceId,
  category,
  defaultType = "expense",
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  workspaceId: string;
  category?: ManagedCategory;
  defaultType?: CategoryType;
  /** Opens the dialog; omit it and use `open`/`onOpenChange` to control it (e.g. from an ItemMenu) */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger render={trigger} /> : null}
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{category ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription className="sr-only">Nome, ícone e cor da categoria.</DialogDescription>
        </DialogHeader>
        {open ? (
          <CategoryForm
            workspaceId={workspaceId}
            category={category}
            defaultType={defaultType}
            onDone={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  workspaceId,
  category,
  defaultType,
  onDone,
}: {
  workspaceId: string;
  category?: ManagedCategory;
  defaultType: CategoryType;
  onDone: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [type, setType] = useState<CategoryType>(category?.type ?? defaultType);
  const [icon, setIcon] = useState(category?.icon ?? "circle");
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]!);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveCategory({ id: category?.id, workspaceId, name, type, icon, color });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(category ? "Categoria atualizada" : "Categoria criada");
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="flex items-center gap-3">
        <CategoryIcon icon={icon} color={color} />
        <div className="grid flex-1 gap-1.5">
          <Label htmlFor="category-name">Nome</Label>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Ex.: Farmácia"
            autoFocus
          />
        </div>
      </div>

      {!category ? (
        <Segmented
          label="Tipo da categoria"
          value={type}
          onChange={setType}
          options={[
            { value: "expense", label: "Despesa" },
            { value: "income", label: "Receita" },
          ]}
        />
      ) : null}

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Ícone</legend>
        <div className="grid grid-cols-8 gap-1.5">
          {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              aria-pressed={icon === key}
              aria-label={key}
              onClick={() => setIcon(key)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg border transition-colors",
                icon === key ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Cor</legend>
        <div className="grid grid-cols-8 gap-1.5">
          {CATEGORY_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={color === value}
              aria-label={`Cor ${value}`}
              onClick={() => setColor(value)}
              className="flex aspect-square items-center justify-center rounded-full"
              style={{ backgroundColor: value }}
            >
              {color === value ? <CheckIcon className="size-4 text-white" aria-hidden /> : null}
            </button>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
