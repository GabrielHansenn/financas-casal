import type { Frequency } from "@/lib/recurrence";
import type { SplitType } from "@/features/transactions/types";

export type RecurrenceItem = {
  id: string;
  type: "income" | "expense";
  amountCents: number;
  description: string | null;
  accountId: string;
  categoryId: string | null;
  paidBy: string | null;
  splitType: Exclude<SplitType, "custom">;
  frequency: Frequency;
  startDate: string;
  nextDate: string;
  endDate: string | null;
  active: boolean;
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};
