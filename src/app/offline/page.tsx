import type { Metadata } from "next";
import { WifiOffIcon } from "lucide-react";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "Sem conexão" };

// Static page precached by the service worker and shown when a page cannot be loaded offline.
// It must work without JavaScript (the app's scripts may not be available), so it uses a plain link.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <Brand />
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <WifiOffIcon className="size-7 text-muted-foreground" aria-hidden />
      </span>
      <div className="grid gap-2">
        <h1 className="text-xl font-semibold">Você está sem internet</h1>
        <p className="text-sm text-muted-foreground">
          Seus dados ficam guardados com segurança no servidor e não ficam salvos neste aparelho. Quando a conexão
          voltar, é só tentar de novo.
        </p>
      </div>
      {/* A full reload on purpose: <Link> needs the app's JS, which may be unavailable offline */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Tentar de novo
      </a>
    </main>
  );
}
