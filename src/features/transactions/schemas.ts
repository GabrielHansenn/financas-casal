import { z } from "@/lib/zod";
import { isISODate } from "@/lib/dates";
import { MAX_INPUT_CENTS } from "@/lib/money";

const cents = z.number().int().nonnegative().max(MAX_INPUT_CENTS);

export const transactionInputSchema = z
  .object({
    id: z.guid().optional(),
    workspaceId: z.guid(),
    type: z.enum(["expense", "income", "transfer"]),
    amountCents: cents.refine((v) => v > 0, { error: "Informe um valor maior que zero." }),
    date: z.string().refine(isISODate, { error: "Data inválida." }),
    accountId: z.guid({ error: "Escolha uma conta." }),
    toAccountId: z.guid().nullable().optional(),
    categoryId: z.guid().nullable().optional(),
    description: z.string().trim().max(200, { error: "Descrição muito longa." }).optional(),
    paidBy: z.guid().nullable().optional(),
    splitType: z.enum(["none", "equal", "proportional", "custom"]),
    customSplits: z.record(z.guid(), cents).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "transfer") {
      if (!value.toAccountId) {
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Escolha a conta de destino." });
      } else if (value.toAccountId === value.accountId) {
        ctx.addIssue({ code: "custom", path: ["toAccountId"], message: "Escolha contas diferentes." });
      }
    }
    if (value.type !== "expense" && value.splitType !== "none") {
      ctx.addIssue({ code: "custom", path: ["splitType"], message: "Só despesas podem ser divididas." });
    }
    if (value.splitType === "custom" && !value.customSplits) {
      ctx.addIssue({ code: "custom", path: ["customSplits"], message: "Informe quanto cada um paga." });
    }
  });

export type TransactionInput = z.infer<typeof transactionInputSchema>;

/** A deleted transaction as it was, used by "Desfazer" to recreate it with the exact splits. */
export const transactionSnapshotSchema = z.object({
  workspaceId: z.guid(),
  type: z.enum(["expense", "income", "transfer"]),
  accountId: z.guid(),
  toAccountId: z.guid().nullable(),
  categoryId: z.guid().nullable(),
  amountCents: cents.refine((v) => v > 0),
  date: z.string().refine(isISODate),
  description: z.string().max(200).nullable(),
  paidBy: z.guid().nullable(),
  splitType: z.enum(["none", "equal", "proportional", "custom"]),
  splits: z.array(z.object({ userId: z.guid(), amountCents: cents })).max(50),
  recurringId: z.guid().nullable(),
  source: z.enum(["manual", "recurring", "import"]),
});

export type TransactionSnapshot = z.infer<typeof transactionSnapshotSchema>;
