import "server-only";
import { todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import type { QuickAddData } from "./types";

/** Accounts, categories and members of the active workspace for the quick-add form. */
export async function getQuickAddData(): Promise<QuickAddData> {
  const { user, active } = await getWorkspaceContext();
  const supabase = await createClient();

  const [accounts, categories, members] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, type")
      .eq("workspace_id", active.id)
      .is("archived_at", null)
      .order("created_at"),
    supabase
      .from("categories")
      .select("id, name, type, icon, color")
      .eq("workspace_id", active.id)
      .is("archived_at", null)
      .order("sort_order")
      .order("name"),
    supabase
      .from("workspace_members")
      .select("user_id, income_cents, joined_at, profile:profiles(display_name)")
      .eq("workspace_id", active.id)
      .order("joined_at"),
  ]);

  if (accounts.error) throw accounts.error;
  if (categories.error) throw categories.error;
  if (members.error) throw members.error;

  return {
    workspaceId: active.id,
    workspaceType: active.type,
    currentUserId: user.id,
    today: todayISO(),
    accounts: accounts.data,
    categories: categories.data,
    members: members.data.map((m) => ({
      userId: m.user_id,
      displayName: m.profile?.display_name ?? "Usuário",
      incomeCents: m.income_cents,
    })),
  };
}
