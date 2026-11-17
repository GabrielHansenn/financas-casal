"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

// Error boundary for authenticated pages. retry() re-fetches the segment (unlike reset(),
// which only re-renders), so a temporary failure such as a network drop can recover.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error ? String(error.digest) : null;

  return (
    <EmptyState
      icon={TriangleAlertIcon}
      title="Algo deu errado"
      description={`Não foi possível carregar esta tela. Verifique sua conexão e tente de novo.${digest ? ` (código ${digest})` : ""}`}
      action={
        <Button variant="outline" onClick={() => retry()}>
          Tentar novamente
        </Button>
      }
    />
  );
}
