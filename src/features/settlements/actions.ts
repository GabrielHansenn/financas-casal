"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { settlementInputSchema } from "./schemas";

type Result = { ok: true } | { ok: false; error: string };

/** Records a payment between two members (e.g. Bruno paid Ana back). */
export async function createSettlement(raw: unknown): Promise<Result> {
  const parsed = settlementInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const input = parsed.data;

  const { workspaces } = await getWorkspaceContext();
  const workspace = workspaces.find((w) => w.id === input.workspaceId);
  if (!workspace) return { ok: false, error: "Você não tem acesso a esse workspace." };
  if (workspace.type !== "shared") return { ok: false, error: "Acertos só existem em workspaces compartilhados." };

  const supabase = await createClient();
  // created_by defaults to auth.uid(); RLS + trigger check that both people are members
  const { error } = await supabase.from("settlements").insert({
    workspace_id: workspace.id,
    from_user_id: input.fromUserId,
    to_user_id: input.toUserId,
    amount_cents: input.amountCents,
    date: input.date,
    note: input.note || null,
  });

  if (error) {
    console.error("[settlements] create", error.code, error.message);
    if (error.code === "23514") return { ok: false, error: "As duas pessoas precisam ser membros do workspace." };
    if (error.code === "42501") return { ok: false, error: "Você não tem permissão para isso." };
    return { ok: false, error: "Não foi possível registrar o acerto. Tente novamente." };
  }

  refresh();
  return { ok: true };
}

export async function deleteSettlement(id: string): Promise<Result> {
  const parsed = z.guid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Acerto inválido." };

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data, error } = await supabase.from("settlements").delete().eq("id", parsed.data).select("id");
  if (error) {
    console.error("[settlements] delete", error.code, error.message);
    return { ok: false, error: "Não foi possível excluir." };
  }
  if (data.length === 0) return { ok: false, error: "Acerto não encontrado." };

  refresh();
  return { ok: true };
}
