"use server";

import { refresh } from "next/cache";
import { z } from "@/lib/zod";
import { todayISO } from "@/lib/dates";
import { dueOccurrences, firstOccurrenceOnOrAfter } from "@/lib/recurrence";
import { computeSplits } from "@/lib/splits";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { recurrenceInputSchema } from "./schemas";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Result = { ok: true } | { ok: false; error: string };
export type GenerationResult = { created: number; failed: number };

const RULE_COLUMNS =
  "id, workspace_id, type, account_id, category_id, amount_cents, description, paid_by, split_type, frequency, start_date, next_date, end_date, created_by";

/**
 * Creates the transactions that are due for the given rules (oldest first, at most
 * MAX_OCCURRENCES_PER_RUN per rule) and advances next_date.
 *
 * Safe to run concurrently (both partners opening the app at once): the unique index
 * (recurring_id, date) makes a duplicate insert fail with 23505, which is skipped, and
 * next_date only moves if nobody else moved it first (optimistic update).
 * If an occurrence fails for another reason, the rule stops at that date and is retried
 * on the next run instead of skipping it.
 */
async function generateDue(supabase: Supabase, workspaceIds: string[], ruleId?: string): Promise<GenerationResult> {
  const today = todayISO();
  let query = supabase
    .from("recurring_transactions")
    .select(RULE_COLUMNS)
    .in("workspace_id", workspaceIds)
    .eq("active", true)
    .lte("next_date", today)
    .order("next_date")
    .limit(50);
  if (ruleId) query = query.eq("id", ruleId);

  const { data: rules, error } = await query;
  if (error) {
    console.error("[recurrences] load due", error.code, error.message);
    return { created: 0, failed: 0 };
  }
  if (rules.length === 0) return { created: 0, failed: 0 };

  // Incomes for proportional splits, read once per workspace
  const splitWorkspaces = [...new Set(rules.filter((r) => r.split_type !== "none").map((r) => r.workspace_id))];
  const membersByWorkspace = new Map<string, { userId: string; incomeCents: number | null }[]>();
  if (splitWorkspaces.length > 0) {
    const { data: members } = await supabase
      .from("workspace_members")
      .select("workspace_id, user_id, income_cents")
      .in("workspace_id", splitWorkspaces);
    for (const m of members ?? []) {
      const list = membersByWorkspace.get(m.workspace_id) ?? [];
      list.push({ userId: m.user_id, incomeCents: m.income_cents });
      membersByWorkspace.set(m.workspace_id, list);
    }
  }

  let created = 0;
  let failed = 0;

  for (const rule of rules) {
    const { dates, nextDate } = dueOccurrences(
      { startDate: rule.start_date, nextDate: rule.next_date, endDate: rule.end_date, frequency: rule.frequency },
      today,
    );
    let advanceTo = nextDate;
    const paidBy = rule.type === "expense" ? (rule.paid_by ?? rule.created_by) : null;

    for (const date of dates) {
      let splits: { user_id: string; amount_cents: number }[] = [];
      if (rule.split_type !== "none") {
        const result = computeSplits({
          amountCents: rule.amount_cents,
          splitType: rule.split_type,
          members: membersByWorkspace.get(rule.workspace_id) ?? [],
          payerId: paidBy ?? rule.created_by,
        });
        if (!result.ok) {
          failed++;
          advanceTo = date;
          break;
        }
        splits = result.splits.map((s) => ({ user_id: s.userId, amount_cents: s.amountCents }));
      }

      const { error: saveError } = await supabase.rpc("save_transaction", {
        p_workspace_id: rule.workspace_id,
        p_type: rule.type,
        p_account_id: rule.account_id,
        p_category_id: rule.category_id ?? undefined,
        p_amount_cents: rule.amount_cents,
        p_date: date,
        p_description: rule.description ?? undefined,
        p_paid_by: paidBy ?? undefined,
        p_split_type: rule.split_type,
        p_splits: splits,
        p_recurring_id: rule.id,
        p_source: "recurring",
      });

      if (saveError) {
        if (saveError.code === "23505") continue; // already generated (concurrent run)
        console.error("[recurrences] generate", rule.id, date, saveError.code, saveError.message);
        failed++;
        advanceTo = date;
        break;
      }
      created++;
    }

    if (advanceTo !== rule.next_date) {
      const { error: updateError } = await supabase
        .from("recurring_transactions")
        .update({ next_date: advanceTo })
        .eq("id", rule.id)
        .eq("next_date", rule.next_date); // optimistic: only if nobody advanced it meanwhile
      if (updateError) console.error("[recurrences] advance", rule.id, updateError.code, updateError.message);
    }
  }

  return { created, failed };
}

/** Called once when the app opens: generates due transactions in all of the user's workspaces. */
export async function runDueRecurrences(): Promise<GenerationResult> {
  const { workspaces } = await getWorkspaceContext();
  const supabase = await createClient();
  return generateDue(
    supabase,
    workspaces.map((w) => w.id),
  );
}

export type SaveRecurrenceResult = ({ ok: true } & GenerationResult) | { ok: false; error: string };

export async function saveRecurrence(raw: unknown): Promise<SaveRecurrenceResult> {
  const parsed = recurrenceInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const input = parsed.data;

  const { user, workspaces } = await getWorkspaceContext();
  const workspace = workspaces.find((w) => w.id === input.workspaceId);
  if (!workspace) return { ok: false, error: "Você não tem acesso a esse workspace." };

  const isShared = workspace.type === "shared";
  const isExpense = input.type === "expense";
  const splitType = isShared && isExpense ? input.splitType : "none";
  const paidBy = isExpense ? (isShared ? (input.paidBy ?? user.id) : user.id) : null;
  const today = todayISO();
  const supabase = await createClient();

  const values = {
    type: input.type,
    amount_cents: input.amountCents,
    description: input.description || null,
    account_id: input.accountId,
    category_id: input.categoryId ?? null,
    paid_by: paidBy,
    split_type: splitType,
    frequency: input.frequency,
    start_date: input.startDate,
    end_date: input.endDate ?? null,
  };

  let ruleId: string;
  if (input.id) {
    const { data: current, error: loadError } = await supabase
      .from("recurring_transactions")
      .select("start_date, frequency, next_date")
      .eq("id", input.id)
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    if (loadError || !current) return { ok: false, error: "Recorrência não encontrada." };

    // A new schedule starts from today on: past dates of the new schedule are not backfilled
    const scheduleChanged = current.start_date !== input.startDate || current.frequency !== input.frequency;
    const nextDate = scheduleChanged
      ? firstOccurrenceOnOrAfter(input.startDate, input.frequency, today)
      : current.next_date;

    const { error } = await supabase
      .from("recurring_transactions")
      .update({ ...values, next_date: nextDate })
      .eq("id", input.id)
      .eq("workspace_id", workspace.id);
    if (error) return { ok: false, error: saveErrorMessage(error.code) };
    ruleId = input.id;
  } else {
    // A start date in the past backfills from that date (capped per run)
    const { data, error } = await supabase
      .from("recurring_transactions")
      .insert({ ...values, workspace_id: workspace.id, next_date: input.startDate })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: saveErrorMessage(error?.code) };
    ruleId = data.id;
  }

  // Generate what is already due right away, so the user sees it without reopening the app
  const generated = await generateDue(supabase, [workspace.id], ruleId);
  refresh();
  return { ok: true, ...generated };
}

function saveErrorMessage(code: string | undefined): string {
  switch (code) {
    case "23503":
      return "Conta ou categoria inválida para este workspace.";
    case "23514":
      return "Dados inválidos. Confira quem paga e a divisão.";
    case "42501":
      return "Você não tem permissão para isso.";
    default:
      return "Não foi possível salvar. Tente novamente.";
  }
}

/** Pausing stops generation. Resuming skips the paused period (no backfill of missed dates). */
export async function setRecurrencePaused(id: string, paused: boolean): Promise<Result> {
  const parsed = z.guid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Recorrência inválida." };

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data: rule } = await supabase
    .from("recurring_transactions")
    .select("start_date, frequency, next_date")
    .eq("id", parsed.data)
    .maybeSingle();
  if (!rule) return { ok: false, error: "Recorrência não encontrada." };

  const today = todayISO();
  const update = paused
    ? { active: false }
    : {
        active: true,
        next_date:
          rule.next_date >= today ? rule.next_date : firstOccurrenceOnOrAfter(rule.start_date, rule.frequency, today),
      };
  const { data, error } = await supabase
    .from("recurring_transactions")
    .update(update)
    .eq("id", parsed.data)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível atualizar." };

  if (!paused) {
    const { workspaces } = await getWorkspaceContext();
    await generateDue(supabase, workspaces.map((w) => w.id), parsed.data);
  }
  refresh();
  return { ok: true };
}

/** Deletes the rule. Transactions already generated stay (recurring_id is set to null). */
export async function deleteRecurrence(id: string): Promise<Result> {
  const parsed = z.guid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Recorrência inválida." };

  await getWorkspaceContext();
  const supabase = await createClient();
  const { data, error } = await supabase.from("recurring_transactions").delete().eq("id", parsed.data).select("id");
  if (error) {
    console.error("[recurrences] delete", error.code, error.message);
    return { ok: false, error: "Não foi possível excluir." };
  }
  if (data.length === 0) return { ok: false, error: "Recorrência não encontrada." };

  refresh();
  return { ok: true };
}

