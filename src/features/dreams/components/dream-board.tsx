"use client";

import { ArrowUpDownIcon, CloudIcon, PartyPopperIcon, PlusIcon, SearchXIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { TransactionSheet } from "@/features/transactions/components/transaction-sheet";
import { dreamsHref, hasActiveFilters, matchesFilters, toColumns, type DreamFilters } from "../board";
import { DREAM_CATEGORIES, DREAM_HORIZONS } from "../labels";
import type { DreamItem, DreamsBoardData } from "../types";
import { DreamCard } from "./dream-card";
import { DreamCover } from "./dream-cover";
import { DreamForm } from "./dream-form";
import { DreamGoalProgress } from "./dream-goal-progress";
import { DreamReactions } from "./dream-reactions";
import { DreamReorder } from "./dream-reorder";

const SELECT_CLASS =
  "h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30";

const longDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
const formatLongDate = (iso: string) => longDate.format(new Date(`${iso}T00:00:00Z`));

export function DreamBoard({ data, filters }: { data: DreamsBoardData; filters: DreamFilters }) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [creating, setCreating] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const wide = useMediaQuery("(min-width: 768px)");

  const isShared = data.workspaceType === "shared";
  const memberNames = useMemo(
    () => Object.fromEntries(data.members.map((m) => [m.userId, m.displayName])),
    [data.members],
  );
  const visible = data.dreams.filter((d) => matchesFilters(d, filters));
  const activeDreams = data.dreams.filter((d) => d.status !== "achieved");
  const achievedCount = data.dreams.length - activeDreams.length;
  const filtered = hasActiveFilters(filters);
  const canOrganize = filters.tab === "active" && !filtered && activeDreams.length > 1;

  const navigate = (next: Partial<DreamFilters>) =>
    startNavigation(() => router.push(dreamsHref({ ...filters, ...next }), { scroll: false }));

  const tabs: { tab: DreamFilters["tab"]; label: string; count: number }[] = [
    { tab: "active", label: "Sonhando e planejando", count: activeDreams.length },
    { tab: "achieved", label: "Realizados", count: achievedCount },
  ];

  if (organizing) {
    return <DreamReorder workspaceId={data.workspaceId} dreams={activeDreams} onDone={() => setOrganizing(false)} />;
  }

  return (
    <div className={cn("grid gap-4 transition-opacity", navigating && "opacity-60")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Seções do quadro" className="flex gap-1 rounded-lg bg-muted p-1">
          {tabs.map(({ tab, label, count }) => (
            <Link
              key={tab}
              href={dreamsHref({ ...filters, tab })}
              scroll={false}
              aria-current={filters.tab === tab ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                filters.tab === tab ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label} <span className="text-muted-foreground tabular-nums">{count}</span>
            </Link>
          ))}
        </nav>
        <div className="flex gap-2">
          {canOrganize ? (
            <Button variant="outline" onClick={() => setOrganizing(true)}>
              <ArrowUpDownIcon aria-hidden /> Organizar
            </Button>
          ) : null}
          <Button onClick={() => setCreating(true)}>
            <PlusIcon aria-hidden /> Novo sonho
          </Button>
        </div>
      </div>

      {data.dreams.length > 0 ? (
        <div className="flex gap-2">
          <select
            aria-label="Filtrar por categoria"
            value={filters.category ?? ""}
            onChange={(e) => navigate({ category: (e.target.value || null) as DreamFilters["category"] })}
            className={SELECT_CLASS}
          >
            <option value="">Todas as categorias</option>
            {DREAM_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por prazo"
            value={filters.horizon ?? ""}
            onChange={(e) => navigate({ horizon: (e.target.value || null) as DreamFilters["horizon"] })}
            className={SELECT_CLASS}
          >
            <option value="">Qualquer prazo</option>
            {DREAM_HORIZONS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
          {isShared ? (
            <select
              aria-label="Filtrar por de quem é o sonho"
              value={filters.owner ?? ""}
              onChange={(e) => navigate({ owner: e.target.value || null })}
              className={SELECT_CLASS}
            >
              <option value="">De todos</option>
              <option value="ours">Nossos</option>
              <option value={data.currentUserId}>Meus</option>
              {data.members
                .filter((m) => m.userId !== data.currentUserId)
                .map((m) => (
                  <option key={m.userId} value={m.userId}>{`De ${m.displayName}`}</option>
                ))}
            </select>
          ) : null}
          {filtered ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate({ category: null, horizon: null, owner: null })}
              aria-label="Limpar filtros"
            >
              <XIcon />
            </Button>
          ) : null}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <BoardEmptyState
          tab={filters.tab}
          filtered={filtered}
          isShared={isShared}
          onCreate={() => setCreating(true)}
          onClear={() => navigate({ category: null, horizon: null, owner: null })}
        />
      ) : filters.tab === "achieved" ? (
        <AchievedAlbum dreams={visible} />
      ) : (
        <div className="flex items-start gap-3">
          {toColumns(visible, wide ? 3 : 2).map((column, i) => (
            <div key={i} className="grid min-w-0 flex-1 gap-3">
              {column.map((dream) => (
                <DreamCard
                  key={dream.id}
                  dream={dream}
                  viewerId={data.currentUserId}
                  memberNames={memberNames}
                  showOwner={isShared}
                  footer={
                    (dream.status === "planning" && dream.goal) || isShared ? (
                      <div className="grid gap-2">
                        {dream.status === "planning" && dream.goal ? (
                          <DreamGoalProgress goal={dream.goal} status={dream.status} today={data.today} compact />
                        ) : null}
                        {isShared ? (
                          <DreamReactions
                            dreamId={dream.id}
                            reactions={dream.reactions}
                            viewerId={data.currentUserId}
                            memberNames={memberNames}
                            compact
                          />
                        ) : null}
                      </div>
                    ) : undefined
                  }
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <TransactionSheet
        open={creating}
        onOpenChange={setCreating}
        title="Novo sonho"
        description="Dê um nome ao sonho; o resto é opcional."
      >
        <DreamForm board={data} onDone={() => setCreating(false)} />
      </TransactionSheet>
    </div>
  );
}

function BoardEmptyState({
  tab,
  filtered,
  isShared,
  onCreate,
  onClear,
}: {
  tab: DreamFilters["tab"];
  filtered: boolean;
  isShared: boolean;
  onCreate: () => void;
  onClear: () => void;
}) {
  if (filtered) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="Nenhum sonho com esses filtros"
        action={
          <Button variant="outline" onClick={onClear}>
            Limpar filtros
          </Button>
        }
      />
    );
  }
  if (tab === "achieved") {
    return (
      <EmptyState
        icon={PartyPopperIcon}
        title="Nenhum sonho realizado ainda"
        description={
          isShared
            ? "Quando vocês realizarem um sonho, ele vem para cá como uma lembrança, com foto e data."
            : "Quando você realizar um sonho, ele vem para cá como uma lembrança, com foto e data."
        }
      />
    );
  }
  return (
    <EmptyState
      icon={CloudIcon}
      title={isShared ? "Qual é o primeiro sonho de vocês?" : "Qual é o seu primeiro sonho?"}
      description="Uma viagem, a casa própria, um pet, uma experiência… Coloque no quadro com uma foto que inspire."
      action={
        <Button onClick={onCreate}>
          <PlusIcon aria-hidden /> Adicionar sonho
        </Button>
      }
    />
  );
}

/** "Sonhos realizados": photo-album look with the moment's photo (or the original cover). */
function AchievedAlbum({ dreams }: { dreams: DreamItem[] }) {
  const sorted = [...dreams].sort((a, b) => (b.achievedAt ?? "").localeCompare(a.achievedAt ?? ""));
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
      {sorted.map((dream, i) => (
        <li key={dream.id} className={cn("transition-transform hover:rotate-0", i % 2 === 0 ? "-rotate-1" : "rotate-1")}>
          <Link
            href={`/sonhos/${dream.id}`}
            className="block rounded-sm bg-white p-2 pb-3 shadow-md ring-1 ring-black/5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-neutral-100"
          >
            <DreamCover
              url={dream.achievedUrl ?? dream.coverUrl}
              category={dream.category}
              alt=""
              className="aspect-square"
              placeholderClassName="aspect-square"
            />
            <p className="mt-2 truncate text-sm font-medium text-neutral-900">{dream.title}</p>
            {dream.achievedAt ? (
              <p className="text-xs text-neutral-500">{formatLongDate(dream.achievedAt)}</p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
