/**
 * True when a transaction's payer or split involves someone who is no longer a member.
 * Such a transaction keeps its amount and split as they were (they can't be recomputed
 * without that person); only description, date, account and category can be edited.
 */
export function involvesFormerMember(
  tx: { paidBy: string | null; splitUserIds: string[] },
  memberIds: string[],
): boolean {
  const members = new Set(memberIds);
  if (tx.splitUserIds.length === 0) return false; // not shared: the payer alone doesn't matter
  return (tx.paidBy !== null && !members.has(tx.paidBy)) || tx.splitUserIds.some((id) => !members.has(id));
}
