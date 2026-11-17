"use client";

import { CheckIcon, ChevronsUpDownIcon, HeartHandshakeIcon, UserIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { switchWorkspace } from "@/features/workspaces/actions";
import type { WorkspaceSummary } from "@/features/workspaces/active-workspace";
import { cn } from "@/lib/utils";

function WorkspaceIcon({ type, className }: { type: WorkspaceSummary["type"]; className?: string }) {
  const Icon = type === "personal" ? UserIcon : HeartHandshakeIcon;
  return <Icon className={cn("size-4", className)} aria-hidden />;
}

export function WorkspaceSwitcher({
  workspaces,
  activeId,
  className,
}: {
  workspaces: WorkspaceSummary[];
  activeId: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0]!;

  const select = (id: string) => {
    if (id === activeId) return;
    startTransition(async () => {
      const result = await switchWorkspace(id);
      if (!result.ok) toast.error(result.error);
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className={cn("h-10 justify-between gap-2 px-3", className)}
            disabled={pending}
            aria-label={`Workspace atual: ${active.name}. Trocar workspace`}
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          <WorkspaceIcon type={active.type} />
          <span className="truncate">{active.name}</span>
        </span>
        <ChevronsUpDownIcon className="size-4 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {workspaces.map((workspace) => (
            <DropdownMenuItem key={workspace.id} onClick={() => select(workspace.id)}>
              <WorkspaceIcon type={workspace.type} />
              <span className="flex-1 truncate">{workspace.name}</span>
              {workspace.id === activeId ? <CheckIcon className="size-4" aria-label="atual" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
