"use client";

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addMonths, formatMonthLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { transactionsHref, type TransactionFilters as Filters } from "../list";
import type { ListOptions } from "../types";

const SELECT_CLASS =
  "h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30";

/** Month navigation + category/account filters, all stored in the URL (?month=&category=&account=). */
export function TransactionFilters({
  filters,
  currentMonth,
  options,
}: {
  filters: Filters;
  currentMonth: string;
  options: ListOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const href = (next: Partial<Filters>) => transactionsHref({ ...filters, ...next }, currentMonth);
  const navigate = (next: Partial<Filters>) => startTransition(() => router.push(href(next), { scroll: false }));
  const hasFilters = filters.categoryId !== null || filters.accountId !== null;

  const expenseCategories = options.categories.filter((c) => c.type === "expense");
  const incomeCategories = options.categories.filter((c) => c.type === "income");
  const archivedSuffix = (archived: boolean) => (archived ? " (arquivada)" : "");

  return (
    <div className={cn("mb-4 grid gap-3 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={<Link href={href({ month: addMonths(filters.month, -1) })} scroll={false} />}
          aria-label="Mês anterior"
        >
          <ChevronLeftIcon />
        </Button>
        <div className="grid text-center">
          <span className="font-medium capitalize">{formatMonthLabel(filters.month)}</span>
          {filters.month !== currentMonth ? (
            <Link
              href={href({ month: currentMonth })}
              scroll={false}
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              Voltar para o mês atual
            </Link>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={<Link href={href({ month: addMonths(filters.month, 1) })} scroll={false} />}
          aria-label="Próximo mês"
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="flex gap-2">
        <select
          aria-label="Filtrar por categoria"
          value={filters.categoryId ?? ""}
          onChange={(e) => navigate({ categoryId: e.target.value || null })}
          className={SELECT_CLASS}
        >
          <option value="">Todas as categorias</option>
          <optgroup label="Despesas">
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {`${c.name}${archivedSuffix(c.archived)}`}
              </option>
            ))}
          </optgroup>
          <optgroup label="Receitas">
            {incomeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {`${c.name}${archivedSuffix(c.archived)}`}
              </option>
            ))}
          </optgroup>
        </select>
        <select
          aria-label="Filtrar por conta"
          value={filters.accountId ?? ""}
          onChange={(e) => navigate({ accountId: e.target.value || null })}
          className={SELECT_CLASS}
        >
          <option value="">Todas as contas</option>
          {options.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {`${a.name}${archivedSuffix(a.archived)}`}
            </option>
          ))}
        </select>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ categoryId: null, accountId: null })}
            aria-label="Limpar filtros"
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
