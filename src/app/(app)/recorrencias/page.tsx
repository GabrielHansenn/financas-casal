import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { RecurrenceList } from "@/features/recurrences/components/recurrence-list";
import { getRecurrences } from "@/features/recurrences/queries";
import { getListOptions, getQuickAddData } from "@/features/transactions/queries";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";

export const metadata: Metadata = { title: "Recorrências" };

export default function RecurrencesPage() {
  return (
    <>
      <PageHeader
        title="Recorrências"
        description="Contas fixas e receitas que se repetem. São lançadas sozinhas quando vocês abrem o app."
      />
      <Suspense fallback={<RecurrencesSkeleton />}>
        <RecurrencesContent />
      </Suspense>
    </>
  );
}

async function RecurrencesContent() {
  const { active } = await getWorkspaceContext();
  const [data, options, recurrences] = await Promise.all([
    getQuickAddData(),
    getListOptions(active.id),
    getRecurrences(active.id),
  ]);
  return <RecurrenceList key={active.id} recurrences={recurrences} data={data} options={options} />;
}

function RecurrencesSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Carregando">
      <Skeleton className="ml-auto h-9 w-44" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
