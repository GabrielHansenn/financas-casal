import { z } from "@/lib/zod";
import { isISODate } from "@/lib/dates";
import { MAX_INPUT_CENTS } from "@/lib/money";

const isoDate = z.string().refine(isISODate, { error: "Data inválida." });
const positiveCents = z
  .number()
  .int()
  .max(MAX_INPUT_CENTS)
  .refine((v) => v > 0, { error: "Informe um valor maior que zero." });

export const goalInputSchema = z.object({
  id: z.guid().optional(),
  workspaceId: z.guid(),
  name: z.string().trim().min(1, { error: "Dê um nome para a meta." }).max(60, { error: "Nome muito longo." }),
  targetCents: positiveCents,
  deadline: isoDate.nullable().optional(),
});

export const contributionInputSchema = z.object({
  id: z.guid().optional(),
  goalId: z.guid(),
  kind: z.enum(["deposit", "withdrawal"]),
  amountCents: positiveCents,
  date: isoDate,
  note: z.string().trim().max(200, { error: "Observação muito longa." }).optional(),
});

export type ContributionInput = z.infer<typeof contributionInputSchema>;
