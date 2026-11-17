"use client";

import Link from "next/link";
import { useState } from "react";
import { Cell, Pie, PieChart, Tooltip, type TooltipContentProps } from "recharts";
import { CategoryIcon } from "@/components/category-icon";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CategorySlice } from "../summary";

export type DonutSlice = CategorySlice & { href: string | null };

const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const formatShare = (share: number) => (share > 0 && share < 0.005 ? "<1%" : percentFormatter.format(share));

const SIZE = 176;

function SliceTooltip({ active, payload }: TooltipContentProps) {
  const slice = payload?.[0]?.payload as DonutSlice | undefined;
  if (!active || !slice) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="font-medium">{slice.name}</p>
      <p className="text-muted-foreground tabular-nums">
        {formatBRL(slice.cents)} · {formatShare(slice.share)}
      </p>
    </div>
  );
}

/**
 * Expense-by-category donut. Each slice wears its category's own color (color follows the
 * entity), separated by a 2px surface gap. The list beside it is the legend and the data
 * table at once: name, icon, share and amount, so identity never depends on color alone.
 */
export function CategoryDonut({ slices, totalCents }: { slices: DonutSlice[]; totalCents: number }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
      <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
        <PieChart width={SIZE} height={SIZE} accessibilityLayer={false} aria-hidden>
          <Pie
            data={slices}
            dataKey="cents"
            nameKey="name"
            innerRadius={58}
            outerRadius={86}
            startAngle={90}
            endAngle={-270}
            stroke="var(--card)"
            strokeWidth={2}
            cornerRadius={3}
            isAnimationActive={false}
            onMouseEnter={(_, index) => setActiveKey(slices[index]?.key ?? null)}
            onMouseLeave={() => setActiveKey(null)}
          >
            {slices.map((slice) => (
              <Cell
                key={slice.key}
                fill={slice.color}
                fillOpacity={activeKey && activeKey !== slice.key ? 0.35 : 1}
              />
            ))}
          </Pie>
          <Tooltip content={SliceTooltip} isAnimationActive={false} />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-sm font-semibold tabular-nums">{formatBRL(totalCents)}</span>
        </div>
      </div>

      <ul className="grid gap-1" aria-label="Despesas por categoria">
        {slices.map((slice) => {
          const content = (
            <>
              <CategoryIcon icon={slice.icon} color={slice.color} size="sm" />
              <span className="min-w-0 flex-1 truncate">{slice.name}</span>
              <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                {formatShare(slice.share)}
              </span>
              <span className="w-24 text-right font-medium tabular-nums">{formatBRL(slice.cents)}</span>
            </>
          );
          const rowClass = cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            activeKey === slice.key && "bg-muted",
          );
          const hover = {
            onMouseEnter: () => setActiveKey(slice.key),
            onMouseLeave: () => setActiveKey(null),
            onFocus: () => setActiveKey(slice.key),
            onBlur: () => setActiveKey(null),
          };
          return (
            <li key={slice.key}>
              {slice.href ? (
                <Link
                  href={slice.href}
                  className={cn(rowClass, "outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50")}
                  {...hover}
                >
                  {content}
                </Link>
              ) : (
                <div className={rowClass} {...hover}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
