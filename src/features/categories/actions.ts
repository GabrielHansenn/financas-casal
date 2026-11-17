"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { CATEGORY_ICONS } from "@/components/category-icon";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { createClient } from "@/lib/supabase/server";

export type CategoryActionResult = { ok: true } | { ok: false; error: string };

const categorySchema = z.object({
  id: z.guid().optional(),
  workspaceId: z.guid(),
  name: z.string().trim().min(1, { error: "Dê um nome à categoria." }).max(40, { error: "Nome muito longo." }),
  type: z.enum(["expense", "income"]),
  icon: z.string().refine((icon) => icon in CATEGORY_ICONS, { error: "Ícone inválido." }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "Cor inválida." }),
});

export async function saveCategory(raw: unknown): Promise<CategoryActionResult> {
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { id, workspaceId, name, type, icon, color } = parsed.data;

  const { workspaces } = await getWorkspaceContext();
  if (!workspaces.some((w) => w.id === workspaceId)) return { ok: false, error: "Workspace inválido." };

  const supabase = await createClient();
  // The type of an existing category never changes (its transactions depend on it)
  const { data, error } = id
    ? await supabase.from("categories").update({ name, icon, color }).eq("id", id).eq("workspace_id", workspaceId).select("id")
    : await supabase
        .from("categories")
        .insert({ workspace_id: workspaceId, name, type, icon, color, sort_order: 50 })
        .select("id");

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Já existe uma categoria com esse nome." };
    console.error("[categories] save", error.code, error.message);
    return { ok: false, error: "Não foi possível salvar a categoria." };
  }
  if (data.length === 0) return { ok: false, error: "Categoria não encontrada." };

  refresh();
  return { ok: true };
}

export async function setCategoryArchived(id: string, archived: boolean): Promise<CategoryActionResult> {
  if (!z.guid().safeParse(id).success) return { ok: false, error: "Categoria inválida." };

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");

  if (error || data.length === 0) return { ok: false, error: "Não foi possível atualizar a categoria." };
  refresh();
  return { ok: true };
}
