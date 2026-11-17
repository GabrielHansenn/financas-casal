import { z } from "@/lib/zod";
import { isISODate } from "@/lib/dates";
import { MAX_INPUT_CENTS } from "@/lib/money";

export const dreamInputSchema = z.object({
  id: z.guid().optional(),
  workspaceId: z.guid(),
  title: z.string().trim().min(1, { error: "Dê um nome para o sonho." }).max(80, { error: "Título muito longo." }),
  why: z.string().trim().max(280, { error: "Texto muito longo (máx. 280 caracteres)." }).optional(),
  category: z.enum(["travel", "home", "vehicle", "experience", "career", "pet", "wedding", "education", "other"]),
  horizon: z.enum(["short", "medium", "long", "someday"]),
  ownerUserId: z.guid().nullable(),
  estimatedCostCents: z
    .number()
    .int()
    .max(MAX_INPUT_CENTS)
    .refine((v) => v > 0, { error: "O custo estimado precisa ser maior que zero." })
    .nullable(),
});

export type DreamInput = z.infer<typeof dreamInputSchema>;

export const dreamImageInputSchema = z.object({
  dreamId: z.guid(),
  kind: z.enum(["cover", "achieved"]),
  path: z.string().max(300),
});

// Real calendar dates only (rejects e.g. 2026-02-31)
const isoDate = z.string().refine(isISODate, { error: "Data inválida." });

export const convertDreamSchema = z.object({
  dreamId: z.guid(),
  name: z.string().trim().min(1, { error: "Dê um nome para a meta." }).max(60, { error: "Nome muito longo." }),
  targetCents: z
    .number()
    .int()
    .max(MAX_INPUT_CENTS)
    .refine((v) => v > 0, { error: "Informe o valor da meta." }),
  deadline: isoDate.nullable(),
});

export const achieveDreamSchema = z.object({
  dreamId: z.guid(),
  achievedAt: isoDate,
});
