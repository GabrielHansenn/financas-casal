import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon, LandmarkIcon, PieChartIcon } from "lucide-react";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { MonthNav } from "@/components/month-nav";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCOUNT_TYPE_LABELS, getAccountsWithBalances } from "@/features/accounts/queries";
import { CategoryDonut, type DonutSlice } from "@/features/dashboard/components/category-donut";
import { getMonthDashboard } from "@/features/dashboard/queries";
import type { MonthSummary } from "@/features/dashboard/summary";
import { QuickAddSlot } from "@/features/transactions/components/quick-add-slot";
import { transactionsHref } from "@/features/transactions/list";
import { getWorkspaceContext } from "@/features/workspaces/active-workspace";
import { addMonths, currentMonth, formatMonthLabel, isISOMonth } from "@/lib/dates";
import { formatBRL, formatSignedBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Início" };

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <PageHeader title="Início" />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeContent searchParams={searchParams} />
      </Suspense>
      <QuickAddSlot />
    </>
  );
}

async function HomeContent({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams;
  // Read the clock only after runtime data (required by cacheComponents)
  const thisMonth = currentMonth();
  const raw = Array.isArray(params.month) ? params.month[0] : params.month;
  const month = raw && isISOMonth(raw) ? raw : thisMonth;

  const { user, active } = await getWorkspaceContext();
  const [{ summary, previous }, accounts] = await Promise.all([
    getMonthDashboard(active.id, month),
    getAccountsWithBalances(active.id),
  ]);
  const totalBalance = accounts.reduce((sum, account) => sum + account.balanceCents, 0);
  const firstName = user.displayName.split(" ")[0];
  const listHref = (filters: { categoryId?: string | null; accountId?: string | null }) =>
    transactionsHref({ month, categoryId: null, accountId: null, ...filters }, thisMonth);

  const slices: DonutSlice[] = summary.slices.map((slice) => ({
    ...slice,
    href: slice.categoryId ? listHref({ categoryId: slice.categoryId }) : null,
  }));

  return (
    <div className="grid gap-6">
      <p className="text-muted-foreground">
        Olá, <span className="font-medium text-foreground">{firstName}</span>. Você está em{" "}
        <span className="font-medium text-foreground">{active.name}</span>.
      </p>

      <MonthNav
        month={month}
        currentMonth={thisMonth}
        hrefFor={(m) => (m === thisMonth ? "/" : `/?month=${m}`)}
      />

      <MonthOverview summary={summary} previous={previous} month={month} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Despesas por categoria</CardTitle>
          <Link
            href={listHref({})}
            className="flex items-center gap-0.5 text-sm text-primary underline-offset-4 hover:underline"
          >
            Ver lançamentos <ChevronRightIcon className="size-4" aria-hidden />
          </Link>
        </CardHeader>
        <CardContent>
          {slices.length === 0 ? (
            <EmptyState
              icon={PieChartIcon}
              title="Nenhuma despesa neste mês"
              description="Quando você lançar despesas, elas aparecem aqui separadas por categoria."
            />
          ) : (
            <CategoryDonut slices={slices} totalCents={summary.expenseCents} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saldo das contas</CardTitle>
          <p className="text-xs text-muted-foreground">Saldo atual, considerando todos os lançamentos</p>
          <p className={cn("text-2xl font-semibold tabular-nums", totalBalance < 0 && "text-destructive")}>
            {formatBRL(totalBalance)}
          </p>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <EmptyState icon={LandmarkIcon} title="Nenhuma conta" description="Crie uma conta em Mais → Contas." />
          ) : (
            <ul className="-mx-2 grid">
              {accounts.map((account) => (
                <li key={account.id}>
                  <Link
                    href={listHref({ accountId: account.id })}
                    className="flex items-center justify-between gap-4 rounded-md px-2 py-2.5 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="grid">
                      <span className="font-medium">{account.name}</span>
                      <span className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.type]}</span>
                    </span>
                    <span className={cn("tabular-nums", account.balanceCents < 0 && "text-destructive")}>
                      {formatBRL(account.balanceCents)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Month balance (hero number) with income × expense bars and the change vs. last month. */
function MonthOverview({ summary, previous, month }: { summary: MonthSummary; previous: MonthSummary; month: string }) {
  const max = Math.max(summary.incomeCents, summary.expenseCents, 1);
  const previousName = formatMonthLabel(addMonths(month, -1)).split(" de ")[0];
  const delta = summary.expenseCents - previous.expenseCents;

  const bars = [
    { label: "Receitas", cents: summary.incomeCents, className: "bg-emerald-500" },
    { label: "Despesas", cents: summary.expenseCents, className: "bg-primary" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Saldo do mês</CardTitle>
        <p
          className={cn(
            "text-3xl font-semibold tabular-nums",
            summary.balanceCents < 0 ? "text-destructive" : summary.balanceCents > 0 && "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {formatSignedBRL(summary.balanceCents)}
        </p>
        <p className="text-xs text-muted-foreground">Receitas menos despesas do mês (transferências não contam)</p>
      </CardHeader>
      <CardContent className="grid gap-3">
        <dl className="grid gap-3">
          {bars.map((bar) => (
            <div key={bar.label} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{bar.label}</dt>
                <dd className="font-medium tabular-nums">{formatBRL(bar.cents)}</dd>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className={cn("h-full rounded-full", bar.className)}
                  style={{ width: `${(bar.cents / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </dl>
        {previous.expenseCents > 0 && delta !== 0 ? (
          <p className="text-xs text-muted-foreground">
            Despesas {formatBRL(Math.abs(delta))} {delta > 0 ? "acima" : "abaixo"} de {previousName}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function HomeSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
