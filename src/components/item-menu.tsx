"use client";

import { EllipsisVerticalIcon, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ItemMenuAction = {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

/**
 * The standard "⋯" menu of a list item (Editar / Arquivar / Excluir…), used on every screen so
 * actions are always in the same place. Destructive actions go last, after a separator.
 * The trigger is 44px on touch screens and 32px from `sm` up.
 */
export function ItemMenu({
  label,
  actions,
  className,
}: {
  /** Accessible name, e.g. "Ações de Nubank" */
  label: string;
  actions: (ItemMenuAction | false | null | undefined)[];
  className?: string;
}) {
  const visible = actions.filter((a): a is ItemMenuAction => !!a);
  const regular = visible.filter((a) => !a.destructive);
  const destructive = visible.filter((a) => a.destructive);
  if (visible.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            className={cn("size-11 shrink-0 text-muted-foreground sm:size-8", className)}
          />
        }
      >
        <EllipsisVerticalIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-44">
        {regular.map((action) => (
          <MenuItem key={action.label} action={action} />
        ))}
        {regular.length > 0 && destructive.length > 0 ? <DropdownMenuSeparator /> : null}
        {destructive.map((action) => (
          <MenuItem key={action.label} action={action} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuItem({ action }: { action: ItemMenuAction }) {
  const Icon = action.icon;
  return (
    <DropdownMenuItem
      variant={action.destructive ? "destructive" : "default"}
      disabled={action.disabled}
      onClick={action.onSelect}
      className="py-2.5 sm:py-1.5"
    >
      <Icon aria-hidden />
      {action.label}
    </DropdownMenuItem>
  );
}
