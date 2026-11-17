import { z } from "@/lib/zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Informe um email válido." }));

const password = z
  .string()
  .min(8, { error: "A senha precisa ter pelo menos 8 caracteres." })
  .max(72, { error: "A senha pode ter no máximo 72 caracteres." });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Informe sua senha." }),
});

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { error: "Informe seu nome." })
    .max(80, { error: "Nome muito longo." }),
  email,
  password,
});

export const magicLinkSchema = z.object({ email });

export type AuthFormState = {
  error?: string;
  message?: string;
  fieldErrors?: Partial<Record<"displayName" | "email" | "password", string>>;
  values?: { email?: string; displayName?: string };
} | null;
