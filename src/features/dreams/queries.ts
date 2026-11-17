import "server-only";
import { todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { signDreamImages } from "./storage";
import type { LinkedGoal } from "./lifecycle";
import { pickDreamOfWeek, type DreamReaction } from "./social";
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

/** Linked goals (name, target, balance) for the given goal ids. RLS applies. */
async function loadGoals(goalIds: string[]): Promise<Map<string, LinkedGoal>> {
  const ids = [...new Set(goalIds)];
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const [goals, progress] = await Promise.all([
    supabase.from("goals").select("id, name, target_cents, deadline, archived_at").in("id", ids),
    supabase.from("goal_progress").select("goal_id, current_cents").in("goal_id", ids),
  ]);
  if (goals.error) throw goals.error;
  if (progress.error) throw progress.error;
  const current = new Map(progress.data.map((p) => [p.goal_id, p.current_cents ?? 0]));
  return new Map(
    goals.data.map((g) => [
      g.id,
      {
        id: g.id,
        name: g.name,
        targetCents: g.target_cents,
        currentCents: current.get(g.id) ?? 0,
        deadline: g.deadline,
        archived: g.archived_at !== null,
      },
    ]),
  );
}

/** Reactions grouped by dream. RLS applies. */
async function loadReactions(workspaceId: string, dreamId?: string): Promise<Map<string, DreamReaction[]>> {
  const supabase = await createClient();
  let query = supabase.from("dream_reactions").select("dream_id, user_id, type").eq("workspace_id", workspaceId).order("created_at");
  if (dreamId) query = query.eq("dream_id", dreamId);
  const { data, error } = await query;
  if (error) throw error;
  const byDream = new Map<string, DreamReaction[]>();
  for (const r of data) {
    const list = byDream.get(r.dream_id) ?? [];
    list.push({ userId: r.user_id, type: r.type });
    byDream.set(r.dream_id, list);
  }
  return byDream;
}

function toItem(
  row: DreamRow,
  urls: Map<string, string>,
  goals: Map<string, LinkedGoal>,
  reactions: Map<string, DreamReaction[]>,
): DreamItem {
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
    goal: row.goal_id ? (goals.get(row.goal_id) ?? null) : null,
    achievedAt: row.achieved_at,
    coverPath: row.cover_image_path,
    coverUrl: row.cover_image_path ? (urls.get(row.cover_image_path) ?? null) : null,
    achievedPath: row.achieved_image_path,
    achievedUrl: row.achieved_image_path ? (urls.get(row.achieved_image_path) ?? null) : null,
    position: row.position,
    createdBy: row.created_by,
    reactions: reactions.get(row.id) ?? [],
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
  const [urls, goals, reactions] = await Promise.all([
    signDreamImages(
      supabase,
      rows.flatMap((r) => [r.cover_image_path, r.achieved_image_path].filter((p): p is string => !!p)),
    ),
    loadGoals(rows.flatMap((r) => (r.goal_id ? [r.goal_id] : []))),
    loadReactions(active.id),
  ]);

  return {
    workspaceId: active.id,
    workspaceType: active.type,
    currentUserId: user.id,
    today: todayISO(),
    members,
    dreams: rows.map((r) => toItem(r, urls, goals, reactions)),
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

  const [urls, members, goals, reactions] = await Promise.all([
    signDreamImages(supabase, [row.cover_image_path, row.achieved_image_path].filter((p): p is string => !!p)),
    loadMembers(active.id),
    loadGoals(row.goal_id ? [row.goal_id] : []),
    loadReactions(active.id, row.id),
  ]);
  return {
    dream: toItem(row, urls, goals, reactions),
    board: { workspaceId: active.id, workspaceType: active.type, currentUserId: user.id, today: todayISO(), members },
  };
}

export type DreamOfWeek = {
  id: string;
  title: string;
  why: string | null;
  category: DreamItem["category"];
  status: DreamItem["status"];
  coverUrl: string | null;
  goal: LinkedGoal | null;
};

/**
 * "Sonho da semana" for the dashboard: one not-yet-achieved dream, stable for the whole ISO week
 * (see pickDreamOfWeek). `null` dream with hasDreams=false means the board is still empty.
 */
export async function getDreamOfWeek(
  workspaceId: string,
  today: string,
): Promise<{ dream: DreamOfWeek | null; hasDreams: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dreams")
    .select("id, title, why, category, status, cover_image_path, goal_id")
    .eq("workspace_id", workspaceId)
    .neq("status", "achieved");
  if (error) throw error;

  const picked = pickDreamOfWeek(data, workspaceId, today);
  if (!picked) {
    const { count } = await supabase
      .from("dreams")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);
    return { dream: null, hasDreams: (count ?? 0) > 0 };
  }

  const [urls, goals] = await Promise.all([
    signDreamImages(supabase, picked.cover_image_path ? [picked.cover_image_path] : []),
    loadGoals(picked.goal_id ? [picked.goal_id] : []),
  ]);
  return {
    hasDreams: true,
    dream: {
      id: picked.id,
      title: picked.title,
      why: picked.why,
      category: picked.category,
      status: picked.status,
      coverUrl: picked.cover_image_path ? (urls.get(picked.cover_image_path) ?? null) : null,
      goal: picked.goal_id ? (goals.get(picked.goal_id) ?? null) : null,
    },
  };
}
