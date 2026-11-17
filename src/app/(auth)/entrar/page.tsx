import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForms } from "@/features/auth/components/login-forms";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1 text-center">
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="text-sm text-muted-foreground">Acesse suas finanças e as do casal.</p>
      </div>
      {/* LoginForms reads search params (next, erro), which are only known at request time */}
      <Suspense fallback={<Skeleton className="h-72 w-full" />}>
        <LoginForms />
      </Suspense>
    </div>
  );
}
