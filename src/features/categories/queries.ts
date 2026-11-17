import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ManagedCategory = {
  id: string;
  name: string;
  type: Database["public"]["Enums"]["category_type"];
  icon: string;
  color: string;
  archived: boolean;
};

/** All categories of a workspace (including archived) for the management page. */
export async function getCategoriesForManagement(workspaceId: string): Promise<ManagedCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, type, icon, color, archived_at")
    .eq("workspace_id", workspaceId)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    icon: c.icon,
    color: c.color,
    archived: c.archived_at !== null,
  }));
}
