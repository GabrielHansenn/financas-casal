"use server";

import type { AuthError } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_WORKSPACE_COOKIE } from "@/features/workspaces/active-workspace";
import { magicLinkSchema, signInSchema, signUpSchema, type AuthFormState } from "./schemas";

// Maps Supabase Auth error codes to pt-BR messages
function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Email ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu email antes de entrar. Verifique sua caixa de entrada.";
    case "user_already_exists":
    case "email_exists":
      return "Já existe uma conta com esse email.";
    case "weak_password":
      return "Senha muito fraca. Use uma senha mais longa.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    case "signup_disabled":
      return "Novos cadastros estão desativados.";
    default:
      return "Não foi possível concluir. Tente novamente.";
  }
}

function fieldErrors(error: z.ZodError): NonNullable<AuthFormState>["fieldErrors"] {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return {
    displayName: flat.displayName?.[0],
    email: flat.email?.[0],
    password: flat.password?.[0],
  };
}

function nextPath(formData: FormData): string {
  return safeNextPath(formData.get("next"), env.siteUrl);
}

export async function signInWithPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error), values };

  redirect(nextPath(formData));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const values = {
    email: String(formData.get("email") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const next = nextPath(formData);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Read by the on_auth_user_created trigger to fill profiles.display_name
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${env.siteUrl}${next}`,
    },
  });
  if (error) return { error: authErrorMessage(error), values };

  // With email confirmation enabled (production) there is no session until the user confirms
  if (!data.session) {
    return {
      message: `Enviamos um link de confirmação para ${parsed.data.email}. Abra o email para ativar sua conta.`,
    };
  }

  redirect(next);
}

export async function sendMagicLink(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = magicLinkSchema.safeParse({ email: formData.get("email") });
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // Used as {{ .RedirectTo }} in the email template; validated again in /auth/confirm
      emailRedirectTo: `${env.siteUrl}${nextPath(formData)}`,
      shouldCreateUser: true,
    },
  });
  if (error) return { error: authErrorMessage(error), values };

  return {
    message: `Enviamos um link de acesso para ${parsed.data.email}. Abra o email neste aparelho para entrar.`,
    values,
  };
}

// Optional form field "next": after signing out, the login page sends the user there
export async function signOut(formData?: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);

  const next = formData ? safeNextPath(formData.get("next"), env.siteUrl) : "/";
  redirect(next === "/" ? "/entrar" : `/entrar?next=${encodeURIComponent(next)}`);
}
