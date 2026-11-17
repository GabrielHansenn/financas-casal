import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { GoalItem } from "./types";

/** Goals of a workspace with their balance and contribution history. RLS applies. */
export async function getGoals(workspaceId: string, { includeArchived = true } = {}): Promise<GoalItem[]> {
  const supabase = await createClient();
  let goalsQuery = supabase
    .from("goals")
    .select("id, name, target_cents, deadline, archived_at, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at");
  if (!includeArchived) goalsQuery = goalsQuery.is("archived_at", null);

  const [goals, progress, contributions, dreams] = await Promise.all([
    goalsQuery,
    supabase.from("goal_progress").select("goal_id, current_cents").eq("workspace_id", workspaceId),
    supabase
      .from("goal_contributions")
      .select("id, goal_id, amount_cents, date, note, created_by")
      .eq("workspace_id", workspaceId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("dreams").select("id, title, status, goal_id").eq("workspace_id", workspaceId).not("goal_id", "is", null),
  ]);
  if (goals.error) throw goals.error;
  if (progress.error) throw progress.error;
  if (contributions.error) throw contributions.error;
  if (dreams.error) throw dreams.error;
  const dreamByGoal = new Map(dreams.data.map((d) => [d.goal_id, { id: d.id, title: d.title, status: d.status }]));

  const currentById = new Map(progress.data.map((p) => [p.goal_id, p.current_cents ?? 0]));
  return goals.data.map((g) => ({
    id: g.id,
    name: g.name,
    targetCents: g.target_cents,
    // The view is the source of truth for the balance (the history below may be truncated)
    currentCents: currentById.get(g.id) ?? 0,
    deadline: g.deadline,
    archived: g.archived_at !== null,
    dream: dreamByGoal.get(g.id) ?? null,
    contributions: contributions.data
      .filter((c) => c.goal_id === g.id)
      .map((c) => ({ id: c.id, amountCents: c.amount_cents, date: c.date, note: c.note, createdBy: c.created_by })),
  }));
}
