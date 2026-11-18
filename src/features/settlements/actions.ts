"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { settlementInputSchema, type SettlementInput } from "./schemas";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Records (or, with `id`, edits) a payment between two people of a shared workspace,
 * e.g. Bruno paid Ana back. One of them may be a former member who still has history there.
 */
export async function saveSettlement(raw: unknown): Promise<Result> {
  const parsed = settlementInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const input = parsed.data;

  const { workspaces } = await getWorkspaceContext();
  const workspace = workspaces.find((w) => w.id === input.workspaceId);
  if (!workspace) return { ok: false, error: "Você não tem acesso a esse workspace." };
  if (workspace.type !== "shared") return { ok: false, error: "Acertos só existem em workspaces compartilhados." };

  const supabase = await createClient();
  const values = {
    from_user_id: input.fromUserId,
    to_user_id: input.toUserId,
    amount_cents: input.amountCents,
    date: input.date,
    note: input.note || null,
  };
  // created_by defaults to auth.uid(); RLS + trigger check who can be part of a settlement
  const { data, error } = input.id
    ? await supabase.from("settlements").update(values).eq("id", input.id).eq("workspace_id", workspace.id).select("id")
    : await supabase.from("settlements").insert({ ...values, workspace_id: workspace.id }).select("id");

  if (error) {
    console.error("[settlements] save", error.code, error.message);
    if (error.code === "23514") return { ok: false, error: "Escolha pessoas que fazem ou fizeram parte do workspace." };
    if (error.code === "42501") return { ok: false, error: "Você não tem permissão para isso." };
    return { ok: false, error: "Não foi possível salvar o acerto. Tente novamente." };
  }
  if (data.length === 0) return { ok: false, error: "Acerto não encontrado." };

  refresh();
  return { ok: true };
}

/** Deletes a settlement and returns it, so "Desfazer" can record it again with saveSettlement. */
export async function deleteSettlement(
  id: string,
): Promise<{ ok: true; snapshot: SettlementInput | null } | { ok: false; error: string }> {
  const parsed = z.guid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Acerto inválido." };

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("settlements")
    .delete()
    .eq("id", parsed.data)
    .select("workspace_id, from_user_id, to_user_id, amount_cents, date, note");
  if (error) {
    console.error("[settlements] delete", error.code, error.message);
    return { ok: false, error: "Não foi possível excluir." };
  }
  const row = data[0];
  if (!row) return { ok: false, error: "Acerto não encontrado." };

  refresh();
  return {
    ok: true,
    snapshot: {
      workspaceId: row.workspace_id,
      fromUserId: row.from_user_id,
      toUserId: row.to_user_id,
      amountCents: row.amount_cents,
      date: row.date,
      note: row.note ?? undefined,
    },
  };
}
