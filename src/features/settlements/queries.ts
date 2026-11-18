import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeSettlement, type LedgerEntry, type Transfer } from "@/lib/settlement";

export type SettlementPerson = { userId: string; displayName: string; isMember: boolean };

export type SettlementRecord = {
  id: string;
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  date: string;
  note: string | null;
};

export type SettlementData = {
  people: SettlementPerson[];
  /** Net balance per user: positive = is owed, negative = owes */
  balances: { userId: string; balanceCents: number }[];
  transfers: Transfer[];
  ledger: LedgerEntry[];
  history: SettlementRecord[];
};

export const SETTLEMENT_HISTORY_LIMIT = 50;

/** Everything the /casal page needs for one shared workspace. RLS applies to every read. */
export async function getSettlementData(workspaceId: string): Promise<SettlementData> {
  const supabase = await createClient();
  const [ledgerResult, membersResult, historyResult] = await Promise.all([
    supabase.rpc("get_settlement_ledger", { p_workspace_id: workspaceId }),
    supabase
      .from("workspace_members")
      .select("user_id, joined_at, profile:profiles(display_name)")
      .eq("workspace_id", workspaceId)
      .order("joined_at"),
    supabase
      .from("settlements")
      .select("id, from_user_id, to_user_id, amount_cents, date, note")
      .eq("workspace_id", workspaceId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(SETTLEMENT_HISTORY_LIMIT),
  ]);
  if (ledgerResult.error) throw ledgerResult.error;
  if (membersResult.error) throw membersResult.error;
  if (historyResult.error) throw historyResult.error;

  const ledger: LedgerEntry[] = ledgerResult.data.map((row) => ({
    kind: row.kind === "settlement" ? "settlement" : "split",
    creditorId: row.creditor_id,
    debtorId: row.debtor_id,
    amountCents: row.amount_cents,
  }));
  const { balances, transfers } = computeSettlement(ledger);

  const people: SettlementPerson[] = membersResult.data.map((m) => ({
    userId: m.user_id,
    displayName: m.profile?.display_name ?? "Usuário",
    isMember: true,
  }));
  // People in the ledger who left the workspace. Their profile stays visible to whoever shares
  // history with them (RLS); a deleted account shows as "Ex-membro".
  const formerIds = [...balances.keys()].filter((userId) => !people.some((p) => p.userId === userId));
  if (formerIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", formerIds);
    for (const userId of formerIds) {
      const displayName = profiles?.find((p) => p.id === userId)?.display_name ?? "Ex-membro";
      people.push({ userId, displayName, isMember: false });
    }
  }

  return {
    people,
    balances: people.map((p) => ({ userId: p.userId, balanceCents: balances.get(p.userId) ?? 0 })),
    transfers,
    ledger,
    history: historyResult.data.map((s) => ({
      id: s.id,
      fromUserId: s.from_user_id,
      toUserId: s.to_user_id,
      amountCents: s.amount_cents,
      date: s.date,
      note: s.note,
    })),
  };
}
