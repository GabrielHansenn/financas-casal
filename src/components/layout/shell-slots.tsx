import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { WorkspaceSwitcher } from "./workspace-switcher";

// Server components for the parts of the shell that depend on the session.
// They read cookies, so the layout renders each one inside its own <Suspense>.

export async function WorkspaceSwitcherSlot({ className }: { className?: string }) {
  const { workspaces, active } = await getWorkspaceContext();
  return <WorkspaceSwitcher workspaces={workspaces} activeId={active.id} className={className} />;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

export async function SidebarUserSlot() {
  const { user } = await getWorkspaceContext();
  return (
    <Link
      href="/mais"
      className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60"
    >
      <Avatar>
        <AvatarFallback>{initials(user.displayName)}</AvatarFallback>
      </Avatar>
      <span className="grid min-w-0 text-sm">
        <span className="truncate font-medium">{user.displayName}</span>
        <span className="truncate text-xs text-muted-foreground">{user.email}</span>
      </span>
    </Link>
  );
}
