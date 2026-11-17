"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { updateProfile } from "../actions";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, action, pending] = useActionState(updateProfile, null);

  useEffect(() => {
    if (state?.ok) toast.success("Perfil atualizado");
    else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="flex items-end gap-2">
      <div className="flex-1">
        <FormField label="Seu nome" name="displayName" defaultValue={displayName} maxLength={80} required />
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
