// Couple settlement: turns the ledger (who covered whose share, who already paid back)
// into net balances and the minimal list of payments that settles everyone.
// All amounts are integer cents.

export type LedgerEntry = {
  kind: "split" | "settlement";
  /** Who is owed (paid the expense, or paid back a debt) */
  creditorId: string;
  /** Who owes */
  debtorId: string;
  amountCents: number;
};

export type Transfer = { fromUserId: string; toUserId: string; amountCents: number };

/**
 * Net balance per user: positive = the others owe them, negative = they owe.
 * The balances always sum to zero.
 */
export function netBalances(entries: LedgerEntry[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.amountCents) || entry.amountCents < 0) {
      throw new RangeError(`Invalid ledger amount: ${entry.amountCents}`);
    }
    if (entry.creditorId === entry.debtorId) continue;
    balances.set(entry.creditorId, (balances.get(entry.creditorId) ?? 0) + entry.amountCents);
    balances.set(entry.debtorId, (balances.get(entry.debtorId) ?? 0) - entry.amountCents);
  }
  return balances;
}

/**
 * Minimal-ish set of payments that zeroes every balance (greedy: the biggest debtor pays
 * the biggest creditor). For two people this is exactly one payment. Deterministic:
 * ties are broken by user id, so every member sees the same suggestion.
 */
export function simplifyDebts(balances: Map<string, number>): Transfer[] {
  const byAmountThenId = (a: [string, number], b: [string, number]) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1);
  const creditors = [...balances].filter(([, v]) => v > 0).sort(byAmountThenId);
  const debtors = [...balances]
    .filter(([, v]) => v < 0)
    .map(([id, v]): [string, number] => [id, -v])
    .sort(byAmountThenId);

  const transfers: Transfer[] = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const creditor = creditors[c]!;
    const debtor = debtors[d]!;
    const amount = Math.min(creditor[1], debtor[1]);
    transfers.push({ fromUserId: debtor[0], toUserId: creditor[0], amountCents: amount });
    creditor[1] -= amount;
    debtor[1] -= amount;
    if (creditor[1] === 0) c++;
    if (debtor[1] === 0) d++;
  }
  return transfers;
}

/** Convenience: ledger → suggested payments. */
export function computeSettlement(entries: LedgerEntry[]): { balances: Map<string, number>; transfers: Transfer[] } {
  const balances = netBalances(entries);
  return { balances, transfers: simplifyDebts(balances) };
}
