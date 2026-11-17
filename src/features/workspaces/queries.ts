import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext, type MemberRole, type WorkspaceSummary } from "./active-workspace";

export type MemberDetail = {
  userId: string;
  displayName: string;
  role: MemberRole;
  incomeCents: number | null;
  isCurrentUser: boolean;
};

export type InviteDetail = {
  id: string;
  email: string;
  expiresAt: string;
};

export type WorkspaceDetail = WorkspaceSummary & {
  members: MemberDetail[];
  /** Pending, non-expired invites. Only visible to owners (RLS); empty for members. */
  invites: InviteDetail[];
  isOwner: boolean;
};

/** All of the current user's workspaces with members and pending invites. */
export async function getWorkspaceDetails(): Promise<{
  workspaces: WorkspaceDetail[];
  activeId: string;
}> {
  const { user, workspaces, active } = await getWorkspaceContext();
  const ids = workspaces.map((w) => w.id);
  const supabase = await createClient();

  const [members, invites] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("workspace_id, user_id, role, income_cents, joined_at, profile:profiles(display_name)")
      .in("workspace_id", ids)
      .order("joined_at"),
    supabase
      .from("workspace_invites")
      .select("id, workspace_id, email, expires_at")
      .in("workspace_id", ids)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  if (members.error) throw members.error;
  if (invites.error) throw invites.error;

  return {
    activeId: active.id,
    workspaces: workspaces.map((workspace) => ({
      ...workspace,
      isOwner: workspace.role === "owner",
      members: members.data
        .filter((m) => m.workspace_id === workspace.id)
        .map((m) => ({
          userId: m.user_id,
          displayName: m.profile?.display_name ?? "Usuário",
          role: m.role,
          incomeCents: m.income_cents,
          isCurrentUser: m.user_id === user.id,
        })),
      invites: invites.data
        .filter((i) => i.workspace_id === workspace.id)
        .map((i) => ({ id: i.id, email: i.email, expiresAt: i.expires_at })),
    })),
  };
}
