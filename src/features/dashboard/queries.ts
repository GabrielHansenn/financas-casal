import "server-only";
import { addMonths, monthRange } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getListOptions } from "@/features/transactions/queries";
import { buildMonthSummary, type MonthSummary, type SummaryRow } from "./summary";

async function periodRows(workspaceId: string, month: string): Promise<SummaryRow[]> {
  const supabase = await createClient();
  const { from, to } = monthRange(month);
  const { data, error } = await supabase.rpc("get_period_summary", {
    p_workspace_id: workspaceId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return data.map((r) => ({ categoryId: r.category_id, type: r.type, totalCents: r.total_cents }));
}

/** Summary of a month plus the previous month's totals for comparison. RLS applies (security invoker). */
export async function getMonthDashboard(
  workspaceId: string,
  month: string,
): Promise<{ summary: MonthSummary; previous: MonthSummary }> {
  const [rows, previousRows, options] = await Promise.all([
    periodRows(workspaceId, month),
    periodRows(workspaceId, addMonths(month, -1)),
    getListOptions(workspaceId),
  ]);
  return {
    summary: buildMonthSummary(rows, options.categories),
    previous: buildMonthSummary(previousRows, options.categories),
  };
}
