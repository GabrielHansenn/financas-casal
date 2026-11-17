import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { RecurrenceItem } from "./types";

/** All recurrences of a workspace (active first, then by next date). RLS applies. */
export async function getRecurrences(workspaceId: string): Promise<RecurrenceItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select(
      "id, type, amount_cents, description, account_id, category_id, paid_by, split_type, frequency, start_date, next_date, end_date, active",
    )
    .eq("workspace_id", workspaceId)
    .order("active", { ascending: false })
    .order("next_date");
  if (error) throw error;

  return data.map((r) => ({
    id: r.id,
    // The table only allows income/expense; custom splits are rejected by a check constraint
    type: r.type === "income" ? "income" : "expense",
    amountCents: r.amount_cents,
    description: r.description,
    accountId: r.account_id,
    categoryId: r.category_id,
    paidBy: r.paid_by,
    splitType: r.split_type === "custom" ? "none" : r.split_type,
    frequency: r.frequency,
    startDate: r.start_date,
    nextDate: r.next_date,
    endDate: r.end_date,
    active: r.active,
  }));
}
