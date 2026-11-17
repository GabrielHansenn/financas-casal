import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

export type WorkspaceType = Database["public"]["Enums"]["workspace_type"];
export type MemberRole = Database["public"]["Enums"]["member_role"];

export type WorkspaceSummary = {
  id: string;
  name: string;
  type: WorkspaceType;
  role: MemberRole;
};

export type WorkspaceContext = {
  user: CurrentUser & { displayName: string };
  workspaces: WorkspaceSummary[];
  active: WorkspaceSummary;
};

/**
 * Resolves the user's workspaces and the active one. The cookie only stores a preference:
 * it is always validated against the user's memberships (RLS), falling back to the
 * personal workspace. Deduplicated per request.
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext> => {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const [membershipsResult, profileResult, cookieStore] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("role, workspace:workspaces(id, name, type)")
      .eq("user_id", user.id),
    supabase.from("profiles").select("display_name").eq("id", user.id).single(),
    cookies(),
  ]);

  if (membershipsResult.error) throw membershipsResult.error;

  const workspaces: WorkspaceSummary[] = membershipsResult.data
    .filter((m) => m.workspace !== null)
    .map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      type: m.workspace.type,
      role: m.role,
    }))
    // Personal first, then shared by name
    .sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name, "pt-BR") : a.type === "personal" ? -1 : 1,
    );

  if (workspaces.length === 0) {
    // Should never happen: the signup trigger always creates a personal workspace
    throw new Error("User has no workspaces");
  }

  const preferredId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const active =
    workspaces.find((w) => w.id === preferredId) ??
    workspaces.find((w) => w.type === "personal") ??
    workspaces[0]!;

  return {
    user: { ...user, displayName: profileResult.data?.display_name ?? user.email },
    workspaces,
    active,
  };
});
