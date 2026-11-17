import type { Metadata } from "next";
import { LandmarkIcon } from "lucide-react";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCOUNT_TYPE_LABELS, getAccountsWithBalances } from "@/features/accounts/queries";
import { QuickAddSlot } from "@/features/transactions/components/quick-add-slot";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

export default function HomePage() {
  return (
    <>
      <PageHeader title="Início" />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent />
      </Suspense>
      <QuickAddSlot />
    </>
  );
}

async function HomeContent() {
  const { user, active } = await getWorkspaceContext();
  const accounts = await getAccountsWithBalances(active.id);
  const total = accounts.reduce((sum, account) => sum + account.balanceCents, 0);
  const firstName = user.displayName.split(" ")[0];

  return (
    <div className="grid gap-6">
      <p className="text-muted-foreground">
        Olá, <span className="font-medium text-foreground">{firstName}</span>. Você está em{" "}
        <span className="font-medium text-foreground">{active.name}</span>.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Saldo total</CardTitle>
          <p className={cn("text-3xl font-semibold tabular-nums", total < 0 && "text-destructive")}>
            {formatBRL(total)}
          </p>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <EmptyState icon={LandmarkIcon} title="Nenhuma conta" description="Crie uma conta para começar." />
          ) : (
            <ul className="divide-y">
              {accounts.map((account) => (
                <li key={account.id} className="flex items-center justify-between gap-4 py-3">
                  <span className="grid">
                    <span className="font-medium">{account.name}</span>
                    <span className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.type]}</span>
                  </span>
                  <span className={cn("tabular-nums", account.balanceCents < 0 && "text-destructive")}>
                    {formatBRL(account.balanceCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
