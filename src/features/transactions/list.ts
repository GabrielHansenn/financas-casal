// Pure helpers for the transaction list: URL filters, signed amounts, grouping and totals.
// Kept free of server/client-only imports so they can be unit tested.
import { isISOMonth } from "@/lib/dates";
import type { TransactionType } from "./types";

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TransactionFilters = {
  month: string; // "YYYY-MM"
  categoryId: string | null;
  accountId: string | null;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Parses `?month=&category=&account=`; invalid values are ignored (fall back to defaults). */
export function parseTransactionFilters(params: RawSearchParams, defaultMonth: string): TransactionFilters {
  const month = first(params.month);
  const category = first(params.category);
  const account = first(params.account);
  return {
    month: month && isISOMonth(month) ? month : defaultMonth,
    categoryId: category && GUID.test(category) ? category.toLowerCase() : null,
    accountId: account && GUID.test(account) ? account.toLowerCase() : null,
  };
}

/** Builds the /transacoes URL for a set of filters (only non-default values are included). */
export function transactionsHref(filters: TransactionFilters, defaultMonth: string): string {
  const params = new URLSearchParams();
  if (filters.month !== defaultMonth) params.set("month", filters.month);
  if (filters.categoryId) params.set("category", filters.categoryId);
  if (filters.accountId) params.set("account", filters.accountId);
  const query = params.toString();
  return query ? `/transacoes?${query}` : "/transacoes";
}

type Signable = { type: TransactionType; amountCents: number; accountId: string; toAccountId: string | null };

/**
 * Effect of a transaction on the money shown: income is positive, expense negative.
 * Transfers are neutral, unless the list is filtered by an account; then they are
 * positive when money arrives in that account and negative when it leaves.
 */
export function signedAmount(tx: Signable, accountFilter: string | null = null): number {
  if (tx.type === "income") return tx.amountCents;
  if (tx.type === "expense") return -tx.amountCents;
  if (!accountFilter) return 0;
  if (tx.toAccountId === accountFilter) return tx.amountCents;
  if (tx.accountId === accountFilter) return -tx.amountCents;
  return 0;
}

export type DayGroup<T> = { date: string; items: T[]; totalCents: number };

/** Groups transactions by date (newest day first), keeping the input order inside each day. */
export function groupByDay<T extends Signable & { date: string }>(
  items: T[],
  accountFilter: string | null = null,
): DayGroup<T>[] {
  const groups = new Map<string, DayGroup<T>>();
  for (const item of items) {
    let group = groups.get(item.date);
    if (!group) {
      group = { date: item.date, items: [], totalCents: 0 };
      groups.set(item.date, group);
    }
    group.items.push(item);
    group.totalCents += signedAmount(item, accountFilter);
  }
  return [...groups.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export type PeriodTotals = { incomeCents: number; expenseCents: number; balanceCents: number };

/** Income and expense totals; transfers move money between accounts and are not counted. */
export function summarize(items: { type: TransactionType; amountCents: number }[]): PeriodTotals {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const item of items) {
    if (item.type === "income") incomeCents += item.amountCents;
    else if (item.type === "expense") expenseCents += item.amountCents;
  }
  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents };
}
