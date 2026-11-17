import type { Metadata } from "next";
import { HeartHandshakeIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";

export const metadata: Metadata = { title: "Casal" };

export default function CouplePage() {
  return (
    <>
      <PageHeader title="Casal" description="Quem deve quanto para quem." />
      <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
        <CoupleContent />
      </Suspense>
    </>
  );
}

async function CoupleContent() {
  const { active, workspaces } = await getWorkspaceContext();

  if (active.type === "personal") {
    const hasShared = workspaces.some((w) => w.type === "shared");
    return (
      <EmptyState
        icon={UserIcon}
        title="Você está no seu espaço pessoal"
        description={
          hasShared
            ? "Troque para o workspace do casal no seletor acima para ver o acerto."
            : "Crie um workspace compartilhado e convide seu par para dividirem as despesas."
        }
        action={
          hasShared ? undefined : (
            <Button nativeButton={false} render={<Link href="/workspaces" />}>
              Criar workspace do casal
            </Button>
          )
        }
      />
    );
  }

  // Placeholder: the settlement screen is implemented in phase 7
  return (
    <EmptyState
      icon={HeartHandshakeIcon}
      title="Acerto do casal em breve"
      description={`O cálculo de quem deve quanto em "${active.name}" chega em uma próxima fase.`}
    />
  );
}
