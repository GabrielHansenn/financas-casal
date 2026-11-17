"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { MAX_INPUT_CENTS } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export type AccountActionResult = { ok: true } | { ok: false; error: string };

const accountSchema = z.object({
  id: z.guid().optional(),
  workspaceId: z.guid(),
  name: z.string().trim().min(1, { error: "Dê um nome à conta." }).max(60, { error: "Nome muito longo." }),
  type: z.enum(["checking", "savings", "credit_card", "cash"]),
  initialBalanceCents: z.number().int().min(-MAX_INPUT_CENTS).max(MAX_INPUT_CENTS),
  ownerUserId: z.guid().nullable(),
});

export async function saveAccount(raw: unknown): Promise<AccountActionResult> {
  const parsed = accountSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { id, workspaceId, ...values } = parsed.data;

  const { workspaces } = await getWorkspaceContext();
  if (!workspaces.some((w) => w.id === workspaceId)) return { ok: false, error: "Workspace inválido." };

  const supabase = await createClient();
  const row = {
    name: values.name,
    type: values.type,
    initial_balance_cents: values.initialBalanceCents,
    owner_user_id: values.ownerUserId,
  };

  const { data, error } = id
    ? await supabase.from("accounts").update(row).eq("id", id).eq("workspace_id", workspaceId).select("id")
    : await supabase.from("accounts").insert({ ...row, workspace_id: workspaceId }).select("id");

  if (error) {
    console.error("[accounts] save", error.code, error.message);
    return {
      ok: false,
      error: error.code === "23514" ? "O dono da conta precisa ser membro do workspace." : "Não foi possível salvar a conta.",
    };
  }
  if (data.length === 0) return { ok: false, error: "Conta não encontrada." };

  refresh();
  return { ok: true };
}

export async function setAccountArchived(id: string, archived: boolean): Promise<AccountActionResult> {
  if (!z.guid().safeParse(id).success) return { ok: false, error: "Conta inválida." };

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");

  if (error || data.length === 0) return { ok: false, error: "Não foi possível atualizar a conta." };
  refresh();
  return { ok: true };
}
