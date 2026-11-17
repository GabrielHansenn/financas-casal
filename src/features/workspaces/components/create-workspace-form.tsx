"use client";

import { useActionState } from "react";
import { FormField, FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { createSharedWorkspace } from "../actions";

export function CreateWorkspaceForm() {
  const [state, action, pending] = useActionState(createSharedWorkspace, null);

  return (
    <form action={action} className="grid gap-3">
      <FormField
        label="Nome"
        name="name"
        defaultValue="Casa"
        maxLength={80}
        placeholder="Ex.: Casa, Nós dois"
        required
      />
      {state?.error ? <FormMessage type="error">{state.error}</FormMessage> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Criando…" : "Criar workspace compartilhado"}
      </Button>
    </form>
  );
}
