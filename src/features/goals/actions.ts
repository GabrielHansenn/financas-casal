"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { formatBRL } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { contributionInputSchema, goalInputSchema } from "./schemas";

type Result = { ok: true } | { ok: false; error: string };

const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Dados inválidos.";

export async function saveGoal(raw: unknown): Promise<Result> {
  const parsed = goalInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  const { workspaces } = await getWorkspaceContext();
  if (!workspaces.some((w) => w.id === input.workspaceId)) {
    return { ok: false, error: "Você não tem acesso a esse workspace." };
  }

  const supabase = await createClient();
  const values = { name: input.name, target_cents: input.targetCents, deadline: input.deadline ?? null };
  const { data, error } = input.id
    ? await supabase.from("goals").update(values).eq("id", input.id).eq("workspace_id", input.workspaceId).select("id")
    : await supabase.from("goals").insert({ ...values, workspace_id: input.workspaceId }).select("id");

  if (error || !data?.length) {
    if (error) console.error("[goals] save", error.code, error.message);
    return { ok: false, error: input.id ? "Meta não encontrada." : "Não foi possível salvar a meta." };
  }
  refresh();
  return { ok: true };
}

export async function setGoalArchived(id: string, archived: boolean): Promise<Result> {
  const parsed = z.guid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Meta inválida." };
  await getWorkspaceContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", parsed.data)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível atualizar a meta." };
  refresh();
  return { ok: true };
}

/** Deletes the goal and its history (contributions cascade). */
export async function deleteGoal(id: string): Promise<Result> {
  const parsed = z.guid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Meta inválida." };
  await getWorkspaceContext();
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals").delete().eq("id", parsed.data).select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível excluir a meta." };
  refresh();
  return { ok: true };
}

export async function addContribution(raw: unknown): Promise<Result> {
  const parsed = contributionInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  await getWorkspaceContext();
  const supabase = await createClient();
  // The goal's workspace comes from the database (RLS: only goals the user can see)
  const { data: goal } = await supabase
    .from("goals")
    .select("id, workspace_id, archived_at")
    .eq("id", input.goalId)
    .maybeSingle();
  if (!goal) return { ok: false, error: "Meta não encontrada." };
  if (goal.archived_at) return { ok: false, error: "Desarquive a meta para movimentá-la." };

  const amount = input.kind === "withdrawal" ? -input.amountCents : input.amountCents;
  const { error } = await supabase.from("goal_contributions").insert({
    goal_id: goal.id,
    workspace_id: goal.workspace_id,
    amount_cents: amount,
    date: input.date,
    note: input.note || null,
  });

  if (error) {
    // 23514: the database guard rejects a balance below zero (also under concurrent withdrawals)
    if (error.code === "23514") {
      const { data: progress } = await supabase
        .from("goal_progress")
        .select("current_cents")
        .eq("goal_id", goal.id)
        .maybeSingle();
      return {
        ok: false,
        error: `Não dá para resgatar mais do que tem na meta (${formatBRL(progress?.current_cents ?? 0)}).`,
      };
    }
    console.error("[goals] contribution", error.code, error.message);
    return { ok: false, error: "Não foi possível registrar. Tente novamente." };
  }
  refresh();
  return { ok: true };
}

export async function deleteContribution(id: string): Promise<Result> {
  const parsed = z.guid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Movimentação inválida." };
  await getWorkspaceContext();
  const supabase = await createClient();
  const { data, error } = await supabase.from("goal_contributions").delete().eq("id", parsed.data).select("id");
  if (error) {
    if (error.code === "23514") {
      return { ok: false, error: "Esse aporte já foi resgatado. Exclua o resgate antes." };
    }
    console.error("[goals] delete contribution", error.code, error.message);
    return { ok: false, error: "Não foi possível excluir." };
  }
  if (!data.length) return { ok: false, error: "Movimentação não encontrada." };
  refresh();
  return { ok: true };
}
