import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { parseDreamFilters } from "@/features/dreams/board";
import { DreamBoard } from "@/features/dreams/components/dream-board";
import { getDreamsBoard } from "@/features/dreams/queries";

export const metadata: Metadata = { title: "Sonhos" };

export default function DreamsPage({ searchParams }: PageProps<"/sonhos">) {
  return (
    <>
      <PageHeader title="Quadro dos Sonhos" description="O que vocês querem viver. As metas cuidam de como chegar lá." />
      <Suspense fallback={<BoardSkeleton />}>
        <DreamsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DreamsContent({ searchParams }: { searchParams: PageProps<"/sonhos">["searchParams"] }) {
  const filters = parseDreamFilters(await searchParams);
  const data = await getDreamsBoard();
  // key: reset local UI state (organize mode, sheets) when the workspace changes
  return <DreamBoard key={data.workspaceId} data={data} filters={filters} />;
}

function BoardSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Carregando">
      <div className="flex justify-between gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex items-start gap-3">
        {[0, 1].map((col) => (
          <div key={col} className="grid flex-1 gap-3">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
