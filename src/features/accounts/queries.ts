import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type AccountType = Database["public"]["Enums"]["account_type"];

export type AccountWithBalance = {
  id: string;
  name: string;
  type: AccountType;
  balanceCents: number;
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão de crédito",
  cash: "Dinheiro",
};

export type ManagedAccount = AccountWithBalance & {
  initialBalanceCents: number;
  ownerUserId: string | null;
  archived: boolean;
};

/** All accounts of a workspace (including archived) for the accounts management page. */
export async function getAccountsForManagement(workspaceId: string): Promise<ManagedAccount[]> {
  const supabase = await createClient();
  const [accounts, balances] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, type, initial_balance_cents, owner_user_id, archived_at")
      .eq("workspace_id", workspaceId)
      .order("created_at"),
    supabase.from("account_balances").select("account_id, balance_cents").eq("workspace_id", workspaceId),
  ]);
  if (accounts.error) throw accounts.error;
  if (balances.error) throw balances.error;

  const balanceById = new Map(balances.data.map((b) => [b.account_id, b.balance_cents ?? 0]));
  return accounts.data.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balanceCents: balanceById.get(a.id) ?? a.initial_balance_cents,
    initialBalanceCents: a.initial_balance_cents,
    ownerUserId: a.owner_user_id,
    archived: a.archived_at !== null,
  }));
}

/** Active (non-archived) accounts of a workspace with their current balance. RLS applies. */
export async function getAccountsWithBalances(workspaceId: string): Promise<AccountWithBalance[]> {
  const supabase = await createClient();

  const [accounts, balances] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, type")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("created_at"),
    supabase.from("account_balances").select("account_id, balance_cents").eq("workspace_id", workspaceId),
  ]);

  if (accounts.error) throw accounts.error;
  if (balances.error) throw balances.error;

  const balanceById = new Map(balances.data.map((b) => [b.account_id, b.balance_cents ?? 0]));

  return accounts.data.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    balanceCents: balanceById.get(account.id) ?? 0,
  }));
}
