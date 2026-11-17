import { cn } from "@/lib/utils";

/** Horizontal progress bar (works in Server and Client Components). */
export function GoalProgressBar({
  fraction,
  reached,
  label,
  className,
}: {
  fraction: number;
  reached: boolean;
  label: string;
  className?: string;
}) {
  const percent = Math.round(fraction * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-2.5 overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width]", reached ? "bg-emerald-500" : "bg-primary")}
        style={{ width: `${fraction * 100}%` }}
      />
    </div>
  );
}
