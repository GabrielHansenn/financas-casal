import { z } from "@/lib/zod";
import { isISODate } from "@/lib/dates";
import { MAX_INPUT_CENTS } from "@/lib/money";

export const settlementInputSchema = z
  .object({
    id: z.guid().optional(),
    workspaceId: z.guid(),
    fromUserId: z.guid({ error: "Escolha quem pagou." }),
    toUserId: z.guid({ error: "Escolha quem recebeu." }),
    amountCents: z
      .number()
      .int()
      .max(MAX_INPUT_CENTS)
      .refine((v) => v > 0, { error: "Informe um valor maior que zero." }),
    date: z.string().refine(isISODate, { error: "Data inválida." }),
    note: z.string().trim().max(200, { error: "Observação muito longa." }).optional(),
  })
  .refine((v) => v.fromUserId !== v.toUserId, {
    path: ["toUserId"],
    error: "Quem paga e quem recebe precisam ser pessoas diferentes.",
  });

export type SettlementInput = z.infer<typeof settlementInputSchema>;
