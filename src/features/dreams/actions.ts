"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { isDreamImagePath } from "./board";
import { isValidAchievedDate, statusAfterUndo } from "./lifecycle";
import { achieveDreamSchema, convertDreamSchema, dreamImageInputSchema, dreamInputSchema } from "./schemas";
import { listDreamFolder, removeDreamFile, removeDreamFiles } from "./storage";

type Result = { ok: true } | { ok: false; error: string };
export type CreateDreamResult = { ok: true; id: string; workspaceId: string } | { ok: false; error: string };

const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Dados inválidos.";

function saveError(code: string | undefined): string {
  if (code === "23514") return "Dados inválidos. Confira de quem é o sonho.";
  if (code === "42501") return "Você não tem permissão para isso.";
  return "Não foi possível salvar o sonho. Tente novamente.";
}

/** Creates or updates a dream. New dreams go to the top of the board. */
export async function saveDream(raw: unknown): Promise<CreateDreamResult> {
  const parsed = dreamInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  const { user, workspaces } = await getWorkspaceContext();
  const workspace = workspaces.find((w) => w.id === input.workspaceId);
  if (!workspace) return { ok: false, error: "Você não tem acesso a esse workspace." };

  const supabase = await createClient();
  const values = {
    title: input.title,
    why: input.why || null,
    category: input.category,
    horizon: input.horizon,
    // Personal workspace: the dream is always the user's own
    owner_user_id: workspace.type === "personal" ? user.id : input.ownerUserId,
    estimated_cost_cents: input.estimatedCostCents,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("dreams")
      .update(values)
      .eq("id", input.id)
      .eq("workspace_id", workspace.id)
      .select("id");
    if (error) return { ok: false, error: saveError(error.code) };
    if (!data.length) return { ok: false, error: "Sonho não encontrado." };
    refresh();
    return { ok: true, id: input.id, workspaceId: workspace.id };
  }

  const { data: top } = await supabase
    .from("dreams")
    .select("position")
    .eq("workspace_id", workspace.id)
    .order("position")
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("dreams")
    .insert({ ...values, workspace_id: workspace.id, position: (top?.position ?? 1) - 1 })
    .select("id")
    .single();
  if (error || !data) {
    if (error) console.error("[dreams] create", error.code, error.message);
    return { ok: false, error: saveError(error?.code) };
  }
  refresh();
  return { ok: true, id: data.id, workspaceId: workspace.id };
}

/**
 * Points the dream's cover (or "achieved" photo) to a file the browser just uploaded.
 * The path must be inside this dream's folder; the previous file is removed.
 */
export async function setDreamImage(raw: unknown): Promise<Result> {
  const parsed = dreamImageInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Imagem inválida." };
  const { dreamId, kind, path } = parsed.data;

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data: dream } = await supabase
    .from("dreams")
    .select("id, workspace_id, status, cover_image_path, achieved_image_path")
    .eq("id", dreamId)
    .maybeSingle();
  if (!dream) return { ok: false, error: "Sonho não encontrado." };
  if (!isDreamImagePath(path, dream.workspace_id, dream.id)) return { ok: false, error: "Imagem inválida." };
  if (kind === "achieved" && dream.status !== "achieved") {
    return { ok: false, error: "A foto do momento é só para sonhos realizados." };
  }

  const previous = kind === "cover" ? dream.cover_image_path : dream.achieved_image_path;
  const { error } = await supabase
    .from("dreams")
    .update(kind === "cover" ? { cover_image_path: path } : { achieved_image_path: path })
    .eq("id", dream.id);
  if (error) {
    console.error("[dreams] set image", error.code, error.message);
    return { ok: false, error: "Não foi possível salvar a imagem." };
  }
  if (previous && previous !== path) await removeDreamFile(supabase, previous);
  refresh();
  return { ok: true };
}

export async function removeDreamImage(dreamId: string, kind: "cover" | "achieved"): Promise<Result> {
  const parsed = z.guid().safeParse(dreamId);
  if (!parsed.success || (kind !== "cover" && kind !== "achieved")) return { ok: false, error: "Imagem inválida." };

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data: dream } = await supabase
    .from("dreams")
    .select("id, cover_image_path, achieved_image_path")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!dream) return { ok: false, error: "Sonho não encontrado." };
  const previous = kind === "cover" ? dream.cover_image_path : dream.achieved_image_path;

  const { error } = await supabase
    .from("dreams")
    .update(kind === "cover" ? { cover_image_path: null } : { achieved_image_path: null })
    .eq("id", parsed.data);
  if (error) return { ok: false, error: "Não foi possível remover a imagem." };
  if (previous) await removeDreamFile(supabase, previous);
  refresh();
  return { ok: true };
}

/**
 * Deletes the dream, then its images. The row goes first so a failed delete never leaves a
 * dream pointing to removed files. The folder is listed before that (listing needs the row);
 * removing files afterwards only needs membership (storage policy).
 */
export async function deleteDream(id: string): Promise<Result> {
  const parsed = z.guid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Sonho inválido." };

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data: dream } = await supabase.from("dreams").select("id, workspace_id").eq("id", parsed.data).maybeSingle();
  if (!dream) return { ok: false, error: "Sonho não encontrado." };

  const files = await listDreamFolder(supabase, dream.workspace_id, dream.id);
  const { data, error } = await supabase.from("dreams").delete().eq("id", dream.id).select("id");
  if (error) {
    console.error("[dreams] delete", error.code, error.message);
    return { ok: false, error: "Não foi possível excluir o sonho." };
  }
  if (!data.length) return { ok: false, error: "Sonho não encontrado." };

  await removeDreamFiles(supabase, files);
  refresh();
  return { ok: true };
}

const reorderSchema = z.object({ workspaceId: z.guid(), ids: z.array(z.guid()).min(1).max(500) });

/** Saves the manual order (position = index in the list). */
export async function reorderDreams(raw: unknown): Promise<Result> {
  const parsed = reorderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Ordem inválida." };

  const { workspaces } = await getWorkspaceContext();
  if (!workspaces.some((w) => w.id === parsed.data.workspaceId)) {
    return { ok: false, error: "Você não tem acesso a esse workspace." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_dreams", {
    p_workspace_id: parsed.data.workspaceId,
    p_ids: parsed.data.ids,
  });
  if (error) {
    console.error("[dreams] reorder", error.code, error.message);
    return { ok: false, error: "Não foi possível salvar a ordem." };
  }
  refresh();
  return { ok: true };
}

export type ConvertDreamResult = { ok: true; goalId: string } | { ok: false; error: string };

/** "Transformar em meta": creates the goal and links it atomically (RPC, RLS applies). */
export async function convertDreamToGoal(raw: unknown): Promise<ConvertDreamResult> {
  const parsed = convertDreamSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const input = parsed.data;

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_dream_to_goal", {
    p_dream_id: input.dreamId,
    p_name: input.name,
    p_target_cents: input.targetCents,
    p_deadline: input.deadline ?? undefined,
  });
  if (error || !data) {
    if (error?.code === "P0002") return { ok: false, error: "Sonho não encontrado." };
    if (error?.code === "23514") return { ok: false, error: "Este sonho já virou meta ou já foi realizado." };
    console.error("[dreams] convert", error?.code, error?.message);
    return { ok: false, error: "Não foi possível criar a meta. Tente novamente." };
  }
  refresh();
  return { ok: true, goalId: data };
}

/** Marks a dream as achieved on a date (today or earlier). The linked goal, if any, stays linked. */
export async function markDreamAchieved(raw: unknown): Promise<Result> {
  const parsed = achieveDreamSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const { dreamId, achievedAt } = parsed.data;
  if (!isValidAchievedDate(achievedAt, todayISO())) {
    return { ok: false, error: "Escolha uma data até hoje." };
  }

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dreams")
    .update({ status: "achieved", achieved_at: achievedAt })
    .eq("id", dreamId)
    .neq("status", "achieved")
    .select("id");
  if (error) {
    console.error("[dreams] achieve", error.code, error.message);
    return { ok: false, error: "Não foi possível marcar como realizado." };
  }
  if (!data.length) return { ok: false, error: "Sonho não encontrado ou já realizado." };
  refresh();
  return { ok: true };
}

/** Undo "achieved": back to planning if the goal is still linked, else dreaming; drops the photo. */
export async function undoDreamAchieved(dreamId: string): Promise<Result> {
  const parsed = z.guid().safeParse(dreamId);
  if (!parsed.success) return { ok: false, error: "Sonho inválido." };

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data: dream } = await supabase
    .from("dreams")
    .select("id, status, goal_id, achieved_image_path")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!dream || dream.status !== "achieved") return { ok: false, error: "Sonho não encontrado." };

  const { error } = await supabase
    .from("dreams")
    .update({ status: statusAfterUndo(dream.goal_id), achieved_at: null, achieved_image_path: null })
    .eq("id", dream.id);
  if (error) {
    console.error("[dreams] undo achieve", error.code, error.message);
    return { ok: false, error: "Não foi possível desfazer." };
  }
  if (dream.achieved_image_path) await removeDreamFile(supabase, dream.achieved_image_path);
  refresh();
  return { ok: true };
}

const reactionSchema = z.object({ dreamId: z.guid(), type: z.enum(["love", "me_too"]) });

/** Toggles the current user's reaction (shared workspaces only; enforced by RLS). */
export async function toggleDreamReaction(raw: unknown): Promise<{ ok: true; reacted: boolean } | { ok: false; error: string }> {
  const parsed = reactionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Reação inválida." };
  const { dreamId, type } = parsed.data;

  const { user } = await getWorkspaceContext();
  const supabase = await createClient();
  const { data: dream } = await supabase.from("dreams").select("id, workspace_id").eq("id", dreamId).maybeSingle();
  if (!dream) return { ok: false, error: "Sonho não encontrado." };

  const { data: removed, error: deleteError } = await supabase
    .from("dream_reactions")
    .delete()
    .eq("dream_id", dream.id)
    .eq("user_id", user.id)
    .eq("type", type)
    .select("type");
  if (deleteError) return { ok: false, error: "Não foi possível reagir." };
  if (removed.length > 0) {
    refresh();
    return { ok: true, reacted: false };
  }

  const { error } = await supabase
    .from("dream_reactions")
    .insert({ dream_id: dream.id, workspace_id: dream.workspace_id, type });
  // 23505: a double tap already added it; same end state
  if (error && error.code !== "23505") {
    if (error.code === "42501") return { ok: false, error: "Reações só existem no workspace do casal." };
    console.error("[dreams] react", error.code, error.message);
    return { ok: false, error: "Não foi possível reagir." };
  }
  refresh();
  return { ok: true, reacted: true };
}
