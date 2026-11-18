"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { FormField, FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sendMagicLink, signInWithPassword } from "../actions";

const URL_NOTICES: Record<string, string> = {
  "conta-excluida": "Sua conta foi excluída. Obrigado por ter usado o Adois.",
};

const URL_ERRORS: Record<string, string> = {
  "link-invalido": "Esse link expirou ou já foi usado. Peça um novo.",
};

export function LoginForms() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const urlError = URL_ERRORS[searchParams.get("erro") ?? ""];
  const urlNotice = URL_NOTICES[searchParams.get("aviso") ?? ""];

  const [passwordState, passwordAction, passwordPending] = useActionState(signInWithPassword, null);
  const [linkState, linkAction, linkPending] = useActionState(sendMagicLink, null);

  const signupHref = next === "/" ? "/cadastro" : `/cadastro?next=${encodeURIComponent(next)}`;

  return (
    <div className="grid gap-6">
      {urlError ? <FormMessage type="error">{urlError}</FormMessage> : null}
      {urlNotice ? <FormMessage type="success">{urlNotice}</FormMessage> : null}

      <Tabs defaultValue="password">
        <TabsList className="w-full">
          <TabsTrigger value="password">Email e senha</TabsTrigger>
          <TabsTrigger value="magic-link">Link por email</TabsTrigger>
        </TabsList>

        <TabsContent value="password">
          <form action={passwordAction} className="grid gap-4 pt-4" noValidate>
            <input type="hidden" name="next" value={next} />
            <FormField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              defaultValue={passwordState?.values?.email}
              error={passwordState?.fieldErrors?.email}
              required
            />
            <FormField
              label="Senha"
              name="password"
              type="password"
              autoComplete="current-password"
              error={passwordState?.fieldErrors?.password}
              required
            />
            {passwordState?.error ? <FormMessage type="error">{passwordState.error}</FormMessage> : null}
            <Button type="submit" size="lg" disabled={passwordPending}>
              {passwordPending ? "Entrando…" : "Entrar"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="magic-link">
          <form action={linkAction} className="grid gap-4 pt-4" noValidate>
            <input type="hidden" name="next" value={next} />
            <p className="text-sm text-muted-foreground">
              Enviaremos um link para você entrar sem senha.
            </p>
            <FormField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              defaultValue={linkState?.values?.email}
              error={linkState?.fieldErrors?.email}
              required
            />
            {linkState?.error ? <FormMessage type="error">{linkState.error}</FormMessage> : null}
            {linkState?.message ? <FormMessage type="success">{linkState.message}</FormMessage> : null}
            <Button type="submit" size="lg" disabled={linkPending}>
              {linkPending ? "Enviando…" : "Enviar link"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem conta?{" "}
        <Link href={signupHref} className="font-medium text-foreground underline-offset-4 hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
