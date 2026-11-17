import "server-only";
import { todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { signDreamImages } from "./storage";
import type { DreamItem, DreamMember, DreamsBoardData } from "./types";

const DREAM_COLUMNS =
  "id, workspace_id, title, why, category, horizon, owner_user_id, estimated_cost_cents, status, goal_id, achieved_at, cover_image_path, achieved_image_path, position, created_by";

type DreamRow = {
  id: string;
  workspace_id: string;
  title: string;
  why: string | null;
  category: DreamItem["category"];
  horizon: DreamItem["horizon"];
  owner_user_id: string | null;
  estimated_cost_cents: number | null;
  status: DreamItem["status"];
  goal_id: string | null;
  achieved_at: string | null;
  cover_image_path: string | null;
  achieved_image_path: string | null;
  position: number;
  created_by: string;
};

function toItem(row: DreamRow, urls: Map<string, string>): DreamItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    why: row.why,
    category: row.category,
    horizon: row.horizon,
    ownerUserId: row.owner_user_id,
    estimatedCostCents: row.estimated_cost_cents,
    status: row.status,
    goalId: row.goal_id,
    achievedAt: row.achieved_at,
    coverPath: row.cover_image_path,
    coverUrl: row.cover_image_path ? (urls.get(row.cover_image_path) ?? null) : null,
    achievedPath: row.achieved_image_path,
    achievedUrl: row.achieved_image_path ? (urls.get(row.achieved_image_path) ?? null) : null,
    position: row.position,
    createdBy: row.created_by,
  };
}

async function loadMembers(workspaceId: string): Promise<DreamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, joined_at, profile:profiles(display_name)")
    .eq("workspace_id", workspaceId)
    .order("joined_at");
  if (error) throw error;
  return data.map((m) => ({ userId: m.user_id, displayName: m.profile?.display_name ?? "Usuário" }));
}

/** Every dream of the active workspace (manual order), with signed image URLs. RLS applies. */
export async function getDreamsBoard(): Promise<DreamsBoardData> {
  const { user, active } = await getWorkspaceContext();
  const supabase = await createClient();
  const [dreamsResult, members] = await Promise.all([
    supabase
      .from("dreams")
      .select(DREAM_COLUMNS)
      .eq("workspace_id", active.id)
      .order("position")
      .order("created_at", { ascending: false }),
    loadMembers(active.id),
  ]);
  if (dreamsResult.error) throw dreamsResult.error;

  const rows = dreamsResult.data;
  const urls = await signDreamImages(
    supabase,
    rows.flatMap((r) => [r.cover_image_path, r.achieved_image_path].filter((p): p is string => !!p)),
  );

  return {
    workspaceId: active.id,
    workspaceType: active.type,
    currentUserId: user.id,
    today: todayISO(),
    members,
    dreams: rows.map((r) => toItem(r, urls)),
  };
}

/** One dream of the active workspace, or null when it does not exist / is not visible. */
export async function getDream(id: string): Promise<{ dream: DreamItem; board: Omit<DreamsBoardData, "dreams"> } | null> {
  const { user, active } = await getWorkspaceContext();
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("dreams")
    .select(DREAM_COLUMNS)
    .eq("id", id)
    .eq("workspace_id", active.id)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const [urls, members] = await Promise.all([
    signDreamImages(supabase, [row.cover_image_path, row.achieved_image_path].filter((p): p is string => !!p)),
    loadMembers(active.id),
  ]);
  return {
    dream: toItem(row, urls),
    board: { workspaceId: active.id, workspaceType: active.type, currentUserId: user.id, today: todayISO(), members },
  };
}
