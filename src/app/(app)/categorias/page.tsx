import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryList } from "@/features/categories/components/category-list";
import { getCategoriesForManagement } from "@/features/categories/queries";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";

export const metadata: Metadata = { title: "Categorias" };

export default function CategoriesPage() {
  return (
    <>
      <PageHeader title="Categorias" description="Categorias do workspace ativo." />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <CategoriesContent />
      </Suspense>
    </>
  );
}

async function CategoriesContent() {
  const { active } = await getWorkspaceContext();
  const categories = await getCategoriesForManagement(active.id);
  return <CategoryList workspaceId={active.id} categories={categories} />;
}
