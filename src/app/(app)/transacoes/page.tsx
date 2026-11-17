import type { Metadata } from "next";
import Link from "next/link";
import { ReceiptTextIcon } from "lucide-react";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickAddSlot } from "@/features/transactions/components/quick-add-slot";
import { TransactionFilters } from "@/features/transactions/components/transaction-filters";
import { TransactionList } from "@/features/transactions/components/transaction-list";
import { groupByDay, parseTransactionFilters, summarize, transactionsHref } from "@/features/transactions/list";
import {
  getListOptions,
  getQuickAddData,
  getTransactions,
  TRANSACTIONS_PAGE_LIMIT,
} from "@/features/transactions/queries";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { currentMonth, formatMonthLabel } from "@/lib/dates";
import { formatBRL, formatSignedBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Transações" };

export default function TransactionsPage({ searchParams }: PageProps<"/transacoes">) {
  return (
    <>
      <PageHeader title="Transações" />
      <Suspense fallback={<ListSkeleton />}>
        <TransactionsContent searchParams={searchParams} />
      </Suspense>
      <QuickAddSlot />
    </>
  );
}

async function TransactionsContent({ searchParams }: { searchParams: PageProps<"/transacoes">["searchParams"] }) {
  const params = await searchParams;
  // Session first: it awaits connection(), so reading the clock below happens at request time
  const { active } = await getWorkspaceContext();
  const month = currentMonth();
  const filters = parseTransactionFilters(params, month);

  const [data, options, { items, truncated }] = await Promise.all([
    getQuickAddData(),
    getListOptions(active.id),
    getTransactions(active.id, filters),
  ]);
  const totals = summarize(items);
  const groups = groupByDay(items, filters.accountId);
  const hasFilters = filters.categoryId !== null || filters.accountId !== null;

  return (
    <>
      <TransactionFilters filters={filters} currentMonth={month} options={options} />

      <dl className="mb-6 grid grid-cols-3 gap-2 rounded-xl border bg-card p-3 text-center">
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Receitas</dt>
          <dd className="text-sm font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
            {formatBRL(totals.incomeCents)}
          </dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Despesas</dt>
          <dd className="text-sm font-semibold tabular-nums">{formatBRL(totals.expenseCents)}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-xs text-muted-foreground">Saldo</dt>
          <dd className={cn("text-sm font-semibold tabular-nums", totals.balanceCents < 0 && "text-destructive")}>
            {formatSignedBRL(totals.balanceCents)}
          </dd>
        </div>
      </dl>

      {groups.length === 0 ? (
        <EmptyState
          icon={ReceiptTextIcon}
          title={hasFilters ? "Nada encontrado" : "Nenhum lançamento neste mês"}
          description={
            hasFilters
              ? `Nenhum lançamento em ${formatMonthLabel(filters.month)} com esses filtros.`
              : "Use o botão + para lançar uma despesa ou receita."
          }
          action={
            hasFilters ? (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={transactionsHref({ ...filters, categoryId: null, accountId: null }, month)} />
                }
              >
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <TransactionList
          key={active.id}
          groups={groups}
          data={data}
          options={options}
          accountFilter={filters.accountId}
        />
      )}

      {truncated ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Mostrando os {TRANSACTIONS_PAGE_LIMIT} lançamentos mais recentes. Use os filtros para ver os demais.
        </p>
      ) : null}
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-16 w-full rounded-xl" />
      {[0, 1].map((i) => (
        <div key={i} className="grid gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
