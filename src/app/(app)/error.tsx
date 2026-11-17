"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

// Error boundary for authenticated pages
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={TriangleAlertIcon}
      title="Algo deu errado"
      description="Não foi possível carregar esta tela. Verifique sua conexão e tente de novo."
      action={
        <Button variant="outline" onClick={reset}>
          Tentar novamente
        </Button>
      }
    />
  );
}
