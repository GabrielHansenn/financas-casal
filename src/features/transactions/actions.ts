"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { createClient } from "@/lib/supabase/server";
import { computeSplits, SPLIT_ERROR_MESSAGES } from "@/lib/splits";
import { transactionInputSchema } from "./schemas";

export type SaveTransactionResult =
  | { ok: true; id: string; warning?: string }
  | { ok: false; error: string };

/**
 * Creates or updates a transaction. The server is authoritative for split amounts:
 * equal/proportional splits are recomputed from the members' incomes in the database;
 * client-provided values are only used for custom splits (and validated).
 */
export async function saveTransaction(raw: unknown): Promise<SaveTransactionResult> {
  const parsed = transactionInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const input = parsed.data;

  const { user, workspaces } = await getWorkspaceContext();
  const workspace = workspaces.find((w) => w.id === input.workspaceId);
  if (!workspace) return { ok: false, error: "Você não tem acesso a esse workspace." };

  const supabase = await createClient();
  const isShared = workspace.type === "shared";

  // Normalize by type
  const isExpense = input.type === "expense";
  const isTransfer = input.type === "transfer";
  const splitType = isExpense && isShared ? input.splitType : "none";
  // Who paid only matters for expenses; personal workspaces always use the current user
  const paidBy = isExpense ? (isShared ? (input.paidBy ?? user.id) : user.id) : null;

  let splits: { user_id: string; amount_cents: number }[] = [];
  let warning: string | undefined;

  if (splitType !== "none") {
    const { data: members, error } = await supabase
      .from("workspace_members")
      .select("user_id, income_cents")
      .eq("workspace_id", workspace.id);
    if (error) return { ok: false, error: "Não foi possível carregar os membros." };

    const result = computeSplits({
      amountCents: input.amountCents,
      splitType,
      members: members.map((m) => ({ userId: m.user_id, incomeCents: m.income_cents })),
      payerId: paidBy ?? user.id,
      custom: input.customSplits,
    });
    if (!result.ok) return { ok: false, error: SPLIT_ERROR_MESSAGES[result.error] };
    if (result.warning === "missing_income") {
      warning = "Faltou a renda de alguém, então a divisão foi meio a meio. Informe as rendas em Workspaces.";
    }
    splits = result.splits.map((s) => ({ user_id: s.userId, amount_cents: s.amountCents }));
  }

  const { data: id, error } = await supabase.rpc("save_transaction", {
    p_id: input.id,
    p_workspace_id: workspace.id,
    p_type: input.type,
    p_account_id: input.accountId,
    p_to_account_id: isTransfer ? (input.toAccountId ?? undefined) : undefined,
    p_category_id: isTransfer ? undefined : (input.categoryId ?? undefined),
    p_amount_cents: input.amountCents,
    p_date: input.date,
    p_description: input.description || undefined,
    p_paid_by: paidBy ?? undefined,
    p_split_type: splitType,
    p_splits: splits,
  });

  if (error || !id) {
    console.error("[transactions] save_transaction", error?.code, error?.message);
    switch (error?.code) {
      case "23503":
        return { ok: false, error: "Conta ou categoria inválida para este workspace." };
      case "23514":
        return { ok: false, error: "Os dados da transação não são válidos. Confira a divisão e as contas." };
      case "P0002":
        return { ok: false, error: "Transação não encontrada." };
      case "42501":
        return { ok: false, error: "Você não tem permissão para isso." };
      default:
        return { ok: false, error: "Não foi possível salvar. Tente novamente." };
    }
  }

  refresh();
  return { ok: true, id, warning };
}

export async function deleteTransaction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z.guid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Transação inválida." };

  await getWorkspaceContext();
  const supabase = await createClient();
  // Splits are removed by ON DELETE CASCADE; RLS limits this to the user's workspaces
  const { data, error } = await supabase.from("transactions").delete().eq("id", parsed.data).select("id");

  if (error) {
    console.error("[transactions] delete", error.code, error.message);
    return { ok: false, error: "Não foi possível excluir." };
  }
  if (data.length === 0) return { ok: false, error: "Transação não encontrada." };

  refresh();
  return { ok: true };
}
