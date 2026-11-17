// Pure aggregation for the monthly dashboard (unit tested). Input rows come from the
// get_period_summary RPC: one row per (category, type) with the summed amount.
import type { TransactionType } from "@/features/transactions/types";

export type SummaryRow = { categoryId: string | null; type: TransactionType; totalCents: number };
export type CategoryRef = { id: string; name: string; icon: string; color: string };

export type CategorySlice = {
  key: string;
  categoryId: string | null;
  name: string;
  icon: string;
  color: string;
  cents: number;
  /** Fraction of the month's expenses, 0..1 */
  share: number;
  /** True for the slice that folds the smallest categories together */
  isRest: boolean;
};

export type MonthSummary = {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  slices: CategorySlice[];
};

export const UNCATEGORIZED = { name: "Sem categoria", icon: "circle", color: "#94a3b8" } as const;
export const REST = { name: "Demais categorias", icon: "circle", color: "#94a3b8" } as const;

/**
 * Totals plus expense-by-category slices, largest first. When there are more than
 * `maxSlices` categories, the smallest ones fold into a single "Demais categorias" slice
 * so the donut stays readable.
 */
export function buildMonthSummary(rows: SummaryRow[], categories: CategoryRef[], maxSlices = 6): MonthSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  const byCategory = new Map<string | null, number>();

  for (const row of rows) {
    if (row.type === "income") incomeCents += row.totalCents;
    else if (row.type === "expense") {
      expenseCents += row.totalCents;
      byCategory.set(row.categoryId, (byCategory.get(row.categoryId) ?? 0) + row.totalCents);
    }
  }

  const share = (cents: number) => (expenseCents > 0 ? cents / expenseCents : 0);
  let slices: CategorySlice[] = [...byCategory]
    .filter(([, cents]) => cents > 0)
    .map(([categoryId, cents]) => {
      const category = categoryId ? categories.find((c) => c.id === categoryId) : undefined;
      const ref = category ?? UNCATEGORIZED;
      return {
        key: categoryId ?? "uncategorized",
        categoryId,
        name: ref.name,
        icon: ref.icon,
        color: ref.color,
        cents,
        share: share(cents),
        isRest: false,
      };
    })
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name, "pt-BR"));

  if (slices.length > maxSlices) {
    const kept = slices.slice(0, maxSlices - 1);
    const restCents = slices.slice(maxSlices - 1).reduce((sum, s) => sum + s.cents, 0);
    slices = [
      ...kept,
      { key: "rest", categoryId: null, ...REST, cents: restCents, share: share(restCents), isRest: true },
    ];
  }

  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents, slices };
}
