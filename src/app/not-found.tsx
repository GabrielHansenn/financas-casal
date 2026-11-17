import type { Metadata } from "next";
import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página não encontrada" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <Brand />
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <SearchXIcon className="size-7 text-muted-foreground" aria-hidden />
      </span>
      <div className="grid gap-2">
        <h1 className="text-xl font-semibold">Página não encontrada</h1>
        <p className="text-sm text-muted-foreground">O endereço pode estar errado ou a página foi removida.</p>
      </div>
      <Button nativeButton={false} render={<Link href="/" />}>
        Voltar para o início
      </Button>
    </main>
  );
}
