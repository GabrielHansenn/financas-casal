"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { isDreamImagePath } from "./board";
import { dreamImageInputSchema, dreamInputSchema } from "./schemas";
import { removeDreamFile, removeDreamFolder } from "./storage";

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

/** Deletes the dream and its images (files first: after the row is gone the folder can't be listed). */
export async function deleteDream(id: string): Promise<Result> {
  const parsed = z.guid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Sonho inválido." };

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data: dream } = await supabase.from("dreams").select("id, workspace_id").eq("id", parsed.data).maybeSingle();
  if (!dream) return { ok: false, error: "Sonho não encontrado." };

  await removeDreamFolder(supabase, dream.workspace_id, dream.id);
  const { data, error } = await supabase.from("dreams").delete().eq("id", dream.id).select("id");
  if (error || !data.length) {
    if (error) console.error("[dreams] delete", error.code, error.message);
    return { ok: false, error: "Não foi possível excluir o sonho." };
  }
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
