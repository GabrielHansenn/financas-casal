"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { FormField, FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { signUp } from "../actions";

export function SignupForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [state, action, pending] = useActionState(signUp, null);

  const loginHref = next === "/" ? "/entrar" : `/entrar?next=${encodeURIComponent(next)}`;

  if (state?.message) {
    return (
      <div className="grid gap-4">
        <FormMessage type="success">{state.message}</FormMessage>
        <Button variant="outline" size="lg" render={<Link href={loginHref} />} nativeButton={false}>
          Voltar para o login
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <form action={action} className="grid gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <FormField
          label="Seu nome"
          name="displayName"
          autoComplete="given-name"
          defaultValue={state?.values?.displayName}
          error={state?.fieldErrors?.displayName}
          required
        />
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={state?.values?.email}
          error={state?.fieldErrors?.email}
          required
        />
        <FormField
          label="Senha"
          name="password"
          type="password"
          autoComplete="new-password"
          error={state?.fieldErrors?.password}
          placeholder="Mínimo de 8 caracteres"
          required
        />
        {state?.error ? <FormMessage type="error">{state.error}</FormMessage> : null}
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Criando conta…" : "Criar conta"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href={loginHref} className="font-medium text-foreground underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
