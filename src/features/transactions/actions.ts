"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { createClient } from "@/lib/supabase/server";
import { referenceErrorMessage } from "@/lib/db-errors";
import { computeSplits, SPLIT_ERROR_MESSAGES } from "@/lib/splits";
import {
  transactionInputSchema,
  transactionSnapshotSchema,
  type TransactionInput,
  type TransactionSnapshot,
} from "./schemas";
import { involvesFormerMember } from "./former-members";

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

  // A shared expense involving someone who left the workspace keeps its amount and split
  // (they can't be recomputed without that person): only the other fields can change.
  if (input.id && isShared) {
    const locked = await saveLockedEdit(supabase, workspace.id, input);
    if (locked) return locked;
  }

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
    const referenceError = referenceErrorMessage(error);
    if (referenceError) return { ok: false, error: referenceError };
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

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Edit of a transaction that involves a former member. Returns null when the transaction
 * doesn't involve one (the normal save path runs). Otherwise updates only description, date,
 * account and category, and rejects changes to type, amount, payer or split.
 */
async function saveLockedEdit(
  supabase: Supabase,
  workspaceId: string,
  input: TransactionInput,
): Promise<SaveTransactionResult | null> {
  const id = input.id;
  if (!id) return null;
  const [{ data: current }, { data: members }] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount_cents, paid_by, split_type, splits:transaction_splits(user_id)")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase.from("workspace_members").select("user_id").eq("workspace_id", workspaceId),
  ]);
  if (!current || !members) return null;

  const involved = {
    paidBy: current.paid_by,
    splitUserIds: current.splits.map((s) => s.user_id),
  };
  if (!involvesFormerMember(involved, members.map((m) => m.user_id))) return null;

  if (
    input.type !== current.type ||
    input.amountCents !== current.amount_cents ||
    (current.type === "expense" && (input.paidBy ?? current.paid_by) !== current.paid_by) ||
    input.splitType !== current.split_type
  ) {
    return {
      ok: false,
      error:
        "Esta despesa envolve alguém que saiu do workspace. Dá para mudar descrição, data, conta e categoria, mas não o valor nem a divisão.",
    };
  }

  const { data, error } = await supabase
    .from("transactions")
    .update({
      description: input.description?.trim() || null,
      date: input.date,
      account_id: input.accountId,
      category_id: current.type === "transfer" ? null : (input.categoryId ?? null),
    })
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("id");

  if (error) {
    console.error("[transactions] locked edit", error.code, error.message);
    return { ok: false, error: referenceErrorMessage(error) ?? "Não foi possível salvar. Tente novamente." };
  }
  if (data.length === 0) return { ok: false, error: "Transação não encontrada." };
  refresh();
  return { ok: true, id: id };
}

/**
 * Deletes a transaction and returns a snapshot of it (with its exact splits), so the
 * "Desfazer" toast can recreate it with restoreTransaction.
 */
export async function deleteTransaction(
  id: string,
): Promise<{ ok: true; snapshot: TransactionSnapshot | null } | { ok: false; error: string }> {
  const parsed = z.guid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Transação inválida." };

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("transactions")
    .select(
      `workspace_id, type, account_id, to_account_id, category_id, amount_cents, date, description, paid_by,
       split_type, recurring_id, source, splits:transaction_splits(user_id, amount_cents)`,
    )
    .eq("id", parsed.data)
    .maybeSingle();

  // Splits are removed by ON DELETE CASCADE; RLS limits this to the user's workspaces
  const { data, error } = await supabase.from("transactions").delete().eq("id", parsed.data).select("id");

  if (error) {
    console.error("[transactions] delete", error.code, error.message);
    return { ok: false, error: "Não foi possível excluir." };
  }
  if (data.length === 0) return { ok: false, error: "Transação não encontrada." };

  refresh();
  const snapshot: TransactionSnapshot | null = row
    ? {
        workspaceId: row.workspace_id,
        type: row.type,
        accountId: row.account_id,
        toAccountId: row.to_account_id,
        categoryId: row.category_id,
        amountCents: row.amount_cents,
        date: row.date,
        description: row.description,
        paidBy: row.paid_by,
        splitType: row.split_type,
        splits: row.splits.map((s) => ({ userId: s.user_id, amountCents: s.amount_cents })),
        recurringId: row.recurring_id,
        source: row.source,
      }
    : null;
  return { ok: true, snapshot };
}

/** Recreates a deleted transaction exactly as it was (the "Desfazer" of deleteTransaction). */
export async function restoreTransaction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = transactionSnapshotSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Não foi possível desfazer." };
  const s = parsed.data;

  const { workspaces } = await getWorkspaceContext();
  if (!workspaces.some((w) => w.id === s.workspaceId)) return { ok: false, error: "Não foi possível desfazer." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_transaction", {
    p_workspace_id: s.workspaceId,
    p_type: s.type,
    p_account_id: s.accountId,
    p_to_account_id: s.toAccountId ?? undefined,
    p_category_id: s.categoryId ?? undefined,
    p_amount_cents: s.amountCents,
    p_date: s.date,
    p_description: s.description ?? undefined,
    p_paid_by: s.paidBy ?? undefined,
    p_split_type: s.splitType,
    p_splits: s.splits.map((split) => ({ user_id: split.userId, amount_cents: split.amountCents })),
    p_recurring_id: s.recurringId ?? undefined,
    p_source: s.source,
  });

  if (error) {
    console.error("[transactions] restore", error.code, error.message);
    return {
      ok: false,
      error: referenceErrorMessage(error) ?? "Não foi possível desfazer. Lance de novo, se precisar.",
    };
  }
  refresh();
  return { ok: true };
}
