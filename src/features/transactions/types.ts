import type { Database } from "@/types/database";

export type TransactionType = Database["public"]["Enums"]["transaction_type"];
export type CategoryType = Database["public"]["Enums"]["category_type"];
export type SplitType = Database["public"]["Enums"]["split_type"];

export type QuickAddAccount = { id: string; name: string; type: Database["public"]["Enums"]["account_type"] };
export type QuickAddCategory = { id: string; name: string; type: CategoryType; icon: string; color: string };
export type QuickAddMember = { userId: string; displayName: string; incomeCents: number | null };

/** Everything the quick-add form needs, loaded once per page render. */
export type QuickAddData = {
  workspaceId: string;
  workspaceType: Database["public"]["Enums"]["workspace_type"];
  currentUserId: string;
  today: string;
  accounts: QuickAddAccount[];
  categories: QuickAddCategory[];
  members: QuickAddMember[];
};

/** Values used to prefill the form when editing an existing transaction (phase 5). */
export type TransactionDraft = {
  id: string;
  type: TransactionType;
  amountCents: number;
  date: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  description: string | null;
  paidBy: string | null;
  splitType: SplitType;
  customSplits: Record<string, number>;
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  expense: "Despesa",
  income: "Receita",
  transfer: "Transferência",
};

export const SPLIT_TYPE_LABELS: Record<SplitType, string> = {
  equal: "Meio a meio",
  proportional: "Proporcional à renda",
  custom: "Personalizada",
  none: "Sem divisão",
};

/** One row of the transaction list. */
export type TransactionListItem = {
  id: string;
  type: TransactionType;
  amountCents: number;
  date: string;
  description: string | null;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  paidBy: string | null;
  payerName: string | null;
  splitType: SplitType;
  splits: { userId: string; amountCents: number }[];
};

/** Accounts and categories of the workspace, including archived ones (for names and filters). */
export type ListOptions = {
  accounts: (QuickAddAccount & { archived: boolean })[];
  categories: (QuickAddCategory & { archived: boolean })[];
};
