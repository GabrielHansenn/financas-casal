"use client";

import { forwardRef, type ComponentProps } from "react";
import { digitsToCents } from "@/lib/money";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats cents without the currency symbol, e.g. 123456 -> "1.234,56". */
function formatAmount(cents: number) {
  return numberFormatter.format(cents / 100);
}

type MoneyInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type" | "size"> & {
  valueCents: number;
  onValueChange: (cents: number) => void;
  size?: "default" | "hero";
};

/**
 * ATM-style money input: opens the numeric keypad and each digit typed shifts the value
 * (1 -> 0,01, 12 -> 0,12, 123 -> 1,23). Backspace removes the last digit. Always integer cents.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { valueCents, onValueChange, size = "default", className, ...props },
  ref,
) {
  return (
    <div
      className={cn(
        "flex items-baseline gap-2 rounded-lg border border-input bg-transparent px-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        size === "hero" ? "py-3" : "h-8",
        className,
      )}
    >
      <span className={cn("text-muted-foreground", size === "hero" ? "text-xl" : "text-sm")}>R$</span>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatAmount(valueCents)}
        onChange={(event) => onValueChange(digitsToCents(event.target.value))}
        // Keep the caret at the end: digits always enter from the right
        onFocus={(event) => {
          const input = event.currentTarget;
          requestAnimationFrame(() => input.setSelectionRange(input.value.length, input.value.length));
        }}
        className={cn(
          "w-full min-w-0 bg-transparent tabular-nums outline-none",
          size === "hero" ? "text-4xl font-semibold tracking-tight" : "text-sm",
        )}
        {...props}
      />
    </div>
  );
});
