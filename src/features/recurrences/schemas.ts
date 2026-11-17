import { z } from "@/lib/zod";
import { isISODate } from "@/lib/dates";
import { MAX_INPUT_CENTS } from "@/lib/money";

const isoDate = z.string().refine(isISODate, { error: "Data inválida." });

export const recurrenceInputSchema = z
  .object({
    id: z.guid().optional(),
    workspaceId: z.guid(),
    type: z.enum(["expense", "income"]),
    amountCents: z
      .number()
      .int()
      .max(MAX_INPUT_CENTS)
      .refine((v) => v > 0, { error: "Informe um valor maior que zero." }),
    description: z.string().trim().max(200, { error: "Descrição muito longa." }).optional(),
    accountId: z.guid({ error: "Escolha uma conta." }),
    categoryId: z.guid().nullable().optional(),
    paidBy: z.guid().nullable().optional(),
    // Custom splits are not supported for recurrences (amounts per person would go stale)
    splitType: z.enum(["none", "equal", "proportional"]),
    frequency: z.enum(["weekly", "monthly", "yearly"]),
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "O fim precisa ser depois do primeiro lançamento." });
    }
    if (v.type !== "expense" && v.splitType !== "none") {
      ctx.addIssue({ code: "custom", path: ["splitType"], message: "Só despesas podem ser divididas." });
    }
  });

export type RecurrenceInput = z.infer<typeof recurrenceInputSchema>;
