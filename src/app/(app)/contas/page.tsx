import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountList } from "@/features/accounts/components/account-list";
import { getAccountsForManagement } from "@/features/accounts/queries";
import { getQuickAddData } from "@/features/transactions/queries";

export const metadata: Metadata = { title: "Contas" };

export default function AccountsPage() {
  return (
    <>
      <PageHeader title="Contas" description="Contas do workspace ativo." />
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <AccountsContent />
      </Suspense>
    </>
  );
}

async function AccountsContent() {
  // getQuickAddData already resolves the active workspace and its members
  const data = await getQuickAddData();
  const accounts = await getAccountsForManagement(data.workspaceId);
  const members = data.workspaceType === "shared" ? data.members : [];

  return <AccountList workspaceId={data.workspaceId} accounts={accounts} members={members} />;
}
