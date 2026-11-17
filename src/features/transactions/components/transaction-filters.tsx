"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { MonthNav } from "@/components/month-nav";
import { Button } from "@/components/ui/button";
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
      <MonthNav month={filters.month} currentMonth={currentMonth} hrefFor={(month) => href({ month })} />

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
