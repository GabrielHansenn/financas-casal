import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DreamDetail } from "@/features/dreams/components/dream-detail";
import { getDream } from "@/features/dreams/queries";
import { z } from "@/lib/zod";

export const metadata: Metadata = { title: "Sonho" };

export default function DreamPage({ params }: PageProps<"/sonhos/[id]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <DreamContent params={params} />
    </Suspense>
  );
}

async function DreamContent({ params }: { params: PageProps<"/sonhos/[id]">["params"] }) {
  const { id } = await params;
  if (!z.guid().safeParse(id).success) notFound();
  const result = await getDream(id);
  // Not found, not visible (RLS) or from another workspace than the active one
  if (!result) notFound();
  return <DreamDetail dream={result.dream} board={result.board} />;
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
      <Skeleton className="h-8 w-2/3" />
    </div>
  );
}
