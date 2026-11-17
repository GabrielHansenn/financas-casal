"use client";

import { WifiOffIcon } from "lucide-react";
import { useOffline } from "next/offline";

/**
 * Shown while the connection is down. With experimental.useOffline, navigations and Server
 * Actions (e.g. saving a transaction) wait and are retried once the connection returns.
 */
export function OfflineBanner() {
  const isOffline = useOffline();
  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-amber-500 shadow-md px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-center text-sm font-medium text-amber-950"
    >
      <WifiOffIcon className="size-4 shrink-0" aria-hidden />
      Sem conexão. Mantenha o app aberto: o que estiver pendente será enviado quando a internet voltar.
    </div>
  );
}
