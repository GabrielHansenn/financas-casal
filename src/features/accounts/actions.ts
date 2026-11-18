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

export type AccountUsage = {
  transactions: number;
  recurrences: number;
  activeRecurrences: number;
  /** Transfers between this account and each other account (deleted when moving into that one) */
  transfersWith: Record<string, number>;
  balanceCents: number;
  initialBalanceCents: number;
};

/** What depends on an account, to explain archive/delete before the user confirms. */
export async function getAccountUsage(
  id: string,
): Promise<{ ok: true; usage: AccountUsage } | { ok: false; error: string }> {
  if (!z.guid().safeParse(id).success) return { ok: false, error: "Conta inválida." };

  await getWorkspaceContext();
  const supabase = await createClient();
  // id is validated as a GUID above, so it is safe inside the filter string
  const [account, balance, transactions, recurrences, transfers] = await Promise.all([
    supabase.from("accounts").select("id, initial_balance_cents").eq("id", id).maybeSingle(),
    supabase.from("account_balances").select("balance_cents").eq("account_id", id).maybeSingle(),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .or(`account_id.eq.${id},to_account_id.eq.${id}`),
    supabase.from("recurring_transactions").select("active").eq("account_id", id),
    supabase
      .from("transactions")
      .select("account_id, to_account_id")
      .eq("type", "transfer")
      .or(`account_id.eq.${id},to_account_id.eq.${id}`),
  ]);
  if (account.error || balance.error || transactions.error || recurrences.error || transfers.error) {
    return { ok: false, error: "Não foi possível carregar os dados da conta." };
  }
  if (!account.data) return { ok: false, error: "Conta não encontrada." };

  const transfersWith: Record<string, number> = {};
  for (const t of transfers.data) {
    const other = t.account_id === id ? t.to_account_id : t.account_id;
    if (other) transfersWith[other] = (transfersWith[other] ?? 0) + 1;
  }

  return {
    ok: true,
    usage: {
      transactions: transactions.count ?? 0,
      recurrences: recurrences.data.length,
      activeRecurrences: recurrences.data.filter((r) => r.active).length,
      transfersWith,
      balanceCents: balance.data?.balance_cents ?? account.data.initial_balance_cents,
      initialBalanceCents: account.data.initial_balance_cents,
    },
  };
}

/**
 * Deletes an account. Without `moveTo` it must have no transactions or recurrences; with
 * `moveTo` they are moved there first (transfers between the two accounts are deleted).
 */
export async function deleteAccount(id: string, moveTo: string | null): Promise<AccountActionResult> {
  if (!z.guid().safeParse(id).success) return { ok: false, error: "Conta inválida." };
  if (moveTo !== null && !z.guid().safeParse(moveTo).success) {
    return { ok: false, error: "Conta de destino inválida." };
  }

  await getWorkspaceContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_account", { p_account_id: id, p_move_to: moveTo ?? undefined });

  if (error) {
    switch (error.code) {
      case "P0002":
        return { ok: false, error: "Conta não encontrada." };
      case "23503":
        return { ok: false, error: "Esta conta tem lançamentos. Escolha para onde movê-los ou arquive a conta." };
      case "22023":
        return { ok: false, error: "Escolha outra conta ativa para receber os lançamentos." };
      default:
        console.error("[accounts] delete", error.code, error.message);
        return { ok: false, error: "Não foi possível excluir a conta." };
    }
  }

  refresh();
  return { ok: true };
}

/** Archiving also pauses the account's recurrences (database trigger). */
export async function setAccountArchived(id: string, archived: boolean): Promise<AccountActionResult> {
  if (!z.guid().safeParse(id).success) return { ok: false, error: "Conta inválida." };

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("[accounts] archive", error.code, error.message);
    return { ok: false, error: archived ? "Não foi possível arquivar a conta." : "Não foi possível restaurar a conta." };
  }
  if (data.length === 0) return { ok: false, error: "Conta não encontrada." };
  refresh();
  return { ok: true };
}
