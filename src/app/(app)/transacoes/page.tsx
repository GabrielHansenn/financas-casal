import type { Metadata } from "next";
import { ReceiptTextIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { QuickAddSlot } from "@/features/transactions/components/quick-add-slot";

export const metadata: Metadata = { title: "Transações" };

// Placeholder: the transaction list is implemented in phase 5
export default function TransactionsPage() {
  return (
    <>
      <PageHeader title="Transações" />
      <EmptyState
        icon={ReceiptTextIcon}
        title="Lista em breve"
        description="Use o botão + para lançar. A lista com filtros por mês, categoria e conta chega na próxima fase."
      />
      <QuickAddSlot />
    </>
  );
}
