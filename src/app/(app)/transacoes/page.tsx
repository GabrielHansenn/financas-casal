import type { Metadata } from "next";
import { ReceiptTextIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Transações" };

// Placeholder: the transaction list is implemented in phase 5
export default function TransactionsPage() {
  return (
    <>
      <PageHeader title="Transações" />
      <EmptyState
        icon={ReceiptTextIcon}
        title="Em breve"
        description="A lista de transações, com filtros por mês, categoria e conta, chega em uma próxima fase."
      />
    </>
  );
}
