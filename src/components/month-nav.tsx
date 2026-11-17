import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { addMonths, formatMonthLabel } from "@/lib/dates";

/**
 * ‹ month › navigation driven by links (works in Server and Client Components).
 * `hrefFor` builds the URL of a given "YYYY-MM" month.
 */
export function MonthNav({
  month,
  currentMonth,
  hrefFor,
}: {
  month: string;
  currentMonth: string;
  hrefFor: (month: string) => string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="ghost"
        size="icon"
        nativeButton={false}
        render={<Link href={hrefFor(addMonths(month, -1))} scroll={false} />}
        aria-label="Mês anterior"
      >
        <ChevronLeftIcon />
      </Button>
      <div className="grid text-center">
        <span className="font-medium capitalize">{formatMonthLabel(month)}</span>
        {month !== currentMonth ? (
          <Link
            href={hrefFor(currentMonth)}
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
        render={<Link href={hrefFor(addMonths(month, 1))} scroll={false} />}
        aria-label="Próximo mês"
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}
