"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toggleDreamReaction } from "../actions";
import { REACTIONS, summarizeReactions, toggleReaction, type DreamReaction, type ReactionType } from "../social";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

/**
 * ❤️ Amei / 🙋 Eu também quero! — tapping again removes the reaction. The UI updates
 * immediately (optimistic) and the server result replaces it after the refresh.
 */
export function DreamReactions({
  dreamId,
  reactions,
  viewerId,
  memberNames,
  compact = false,
}: {
  dreamId: string;
  reactions: DreamReaction[];
  viewerId: string;
  memberNames: Record<string, string>;
  compact?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, applyToggle] = useOptimistic(reactions, (state, type: ReactionType) =>
    toggleReaction(state, viewerId, type),
  );
  const summary = summarizeReactions(optimistic, viewerId, memberNames);

  const toggle = (type: ReactionType) =>
    startTransition(async () => {
      applyToggle(type);
      const result = await toggleDreamReaction({ dreamId, type });
      if (!result.ok) toast.error(result.error);
    });

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        {REACTIONS.map(({ type, emoji, label }) => {
          const { count, mine, names } = summary[type];
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggle(type)}
              aria-pressed={mine}
              aria-label={`${label}${count ? `: ${joinNames(names)}` : ""}`}
              title={count ? `${label}: ${joinNames(names)}` : label}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                mine ? "border-primary/40 bg-primary/10 font-medium" : "hover:bg-muted",
              )}
            >
              <span aria-hidden>{emoji}</span>
              {compact ? null : <span>{label}</span>}
              {count > 0 ? <span className="tabular-nums">{count}</span> : null}
              {count > 0 ? (
                <span className="flex -space-x-1.5" aria-hidden>
                  {names.slice(0, 3).map((name) => (
                    <span
                      key={name}
                      className="flex size-5 items-center justify-center rounded-full border border-background bg-muted text-[10px] font-semibold"
                    >
                      {name === "Você" ? "EU" : initials(name)}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {!compact && (summary.love.count > 0 || summary.me_too.count > 0) ? (
        <p className="text-xs text-muted-foreground">
          {[
            summary.love.count
              ? `❤️ ${joinNames(summary.love.names)} ${summary.love.count > 1 ? "amaram" : "amou"}`
              : null,
            summary.me_too.count
              ? `🙋 ${joinNames(summary.me_too.names)} também ${summary.me_too.count > 1 ? "querem" : "quer"}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
