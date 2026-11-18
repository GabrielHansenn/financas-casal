import "server-only";
import { monthRange, todayISO } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import type { TransactionFilters } from "./list";
import type { ListOptions, QuickAddData, TransactionListItem } from "./types";

/** Accounts, categories and members of the active workspace for the quick-add form. */
export async function getQuickAddData(): Promise<QuickAddData> {
  const { user, active } = await getWorkspaceContext();
  const supabase = await createClient();

  const [accounts, categories, members] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, type")
      .eq("workspace_id", active.id)
      .is("archived_at", null)
      .order("created_at"),
    supabase
      .from("categories")
      .select("id, name, type, icon, color")
      .eq("workspace_id", active.id)
      .is("archived_at", null)
      .order("sort_order")
      .order("name"),
    supabase
      .from("workspace_members")
      .select("user_id, income_cents, joined_at, profile:profiles(display_name)")
      .eq("workspace_id", active.id)
      .order("joined_at"),
  ]);

  if (accounts.error) throw accounts.error;
  if (categories.error) throw categories.error;
  if (members.error) throw members.error;

  return {
    workspaceId: active.id,
    workspaceType: active.type,
    currentUserId: user.id,
    today: todayISO(),
    accounts: accounts.data,
    categories: categories.data,
    members: members.data.map((m) => ({
      userId: m.user_id,
      displayName: m.profile?.display_name ?? "Usuário",
      incomeCents: m.income_cents,
    })),
  };
}

/** Max rows loaded per month; above this the page shows a notice to narrow the filters. */
export const TRANSACTIONS_PAGE_LIMIT = 500;

/** Transactions of a workspace in a month, newest first, with optional category/account filters. */
export async function getTransactions(
  workspaceId: string,
  filters: TransactionFilters,
): Promise<{ items: TransactionListItem[]; truncated: boolean }> {
  const supabase = await createClient();
  const { from, to } = monthRange(filters.month);

  let query = supabase
    .from("transactions")
    .select(
      `id, type, amount_cents, date, description, account_id, to_account_id, category_id, paid_by,
       split_type, splits:transaction_splits(user_id, amount_cents),
       created_by, payer:profiles!transactions_paid_by_fkey(display_name),
       creator:profiles!transactions_created_by_fkey(display_name)`,
    )
    .eq("workspace_id", workspaceId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(TRANSACTIONS_PAGE_LIMIT + 1);

  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  // accountId is validated as a GUID by parseTransactionFilters, so it is safe in the filter string
  if (filters.accountId) {
    query = query.or(`account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const items = data.slice(0, TRANSACTIONS_PAGE_LIMIT).map((t) => ({
    id: t.id,
    type: t.type,
    amountCents: t.amount_cents,
    date: t.date,
    description: t.description,
    accountId: t.account_id,
    toAccountId: t.to_account_id,
    categoryId: t.category_id,
    paidBy: t.paid_by,
    payerName: t.payer?.display_name ?? null,
    createdBy: t.created_by,
    creatorName: t.creator?.display_name ?? null,
    splitType: t.split_type,
    splits: t.splits.map((s) => ({ userId: s.user_id, amountCents: s.amount_cents })),
  }));
  return { items, truncated: data.length > TRANSACTIONS_PAGE_LIMIT };
}

/** All accounts and categories (archived included) so old transactions still show their names. */
export async function getListOptions(workspaceId: string): Promise<ListOptions> {
  const supabase = await createClient();
  const [accounts, categories] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, type, archived_at")
      .eq("workspace_id", workspaceId)
      .order("created_at"),
    supabase
      .from("categories")
      .select("id, name, type, icon, color, archived_at")
      .eq("workspace_id", workspaceId)
      .order("sort_order")
      .order("name"),
  ]);
  if (accounts.error) throw accounts.error;
  if (categories.error) throw categories.error;

  return {
    accounts: accounts.data.map(({ archived_at, ...a }) => ({ ...a, archived: archived_at !== null })),
    categories: categories.data.map(({ archived_at, ...c }) => ({ ...c, archived: archived_at !== null })),
  };
}
