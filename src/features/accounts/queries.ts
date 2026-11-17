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
