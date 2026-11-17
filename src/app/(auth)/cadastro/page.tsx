import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1 text-center">
        <h1 className="text-2xl font-semibold">Criar conta</h1>
        <p className="text-sm text-muted-foreground">
          Você ganha um espaço pessoal e pode convidar seu par depois.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
