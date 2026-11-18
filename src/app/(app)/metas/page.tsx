import type { Metadata } from "next";
import { PlusIcon, TargetIcon } from "lucide-react";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { HelpButton } from "@/features/help/components/help-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalCard } from "@/features/goals/components/goal-card";
import { GoalDialog } from "@/features/goals/components/goal-dialog";
import { getGoals } from "@/features/goals/queries";
import { getQuickAddData } from "@/features/transactions/queries";

export const metadata: Metadata = { title: "Metas" };

export default function GoalsPage() {
  return (
    <>
      <PageHeader
        title="Metas"
        description="Guardem dinheiro para um objetivo e acompanhem o progresso."
        actions={<HelpButton topic="goals" />}
      />
      <Suspense fallback={<GoalsSkeleton />}>
        <GoalsContent />
      </Suspense>
    </>
  );
}

async function GoalsContent() {
  // Reuses the quick-add loader: active workspace, current user, members and "today"
  const data = await getQuickAddData();
  const goals = await getGoals(data.workspaceId);
  const memberNames = Object.fromEntries(data.members.map((m) => [m.userId, m.displayName]));
  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);

  const newGoalButton = (
    <GoalDialog
      workspaceId={data.workspaceId}
      today={data.today}
      trigger={
        <Button>
          <PlusIcon aria-hidden /> Nova meta
        </Button>
      }
    />
  );

  const card = (goal: (typeof goals)[number]) => (
    <GoalCard
      key={goal.id}
      goal={goal}
      workspaceId={data.workspaceId}
      today={data.today}
      currentUserId={data.currentUserId}
      memberNames={memberNames}
    />
  );

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">{newGoalButton}</div>

      {active.length === 0 ? (
        <EmptyState
          icon={TargetIcon}
          title="Nenhuma meta ativa"
          description="Crie uma meta como viagem, reserva de emergência ou troca de carro, e registrem os aportes."
        />
      ) : (
        <div className="grid gap-4">{active.map(card)}</div>
      )}

      {archived.length > 0 ? (
        <details className="grid gap-4">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none">
            Arquivadas ({archived.length})
          </summary>
          <div className="mt-4 grid gap-4">{archived.map(card)}</div>
        </details>
      ) : null}
    </div>
  );
}

function GoalsSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Carregando">
      <Skeleton className="ml-auto h-9 w-32" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}
