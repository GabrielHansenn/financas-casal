"use client";

import { useState, useTransition } from "react";
import { FormMessage } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "../actions";

export function AcceptInviteButton({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const accept = () => {
    setError(null);
    startTransition(async () => {
      // On success the action redirects to the home page of the new workspace
      const result = await acceptInvite(token);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="grid gap-3">
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      <Button size="lg" onClick={accept} disabled={pending}>
        {pending ? "Entrando no workspace…" : "Aceitar convite"}
      </Button>
    </div>
  );
}
