"use client";

import { ArrowLeftIcon, PencilIcon, QuoteIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/money";
import { TransactionSheet } from "@/features/transactions/components/transaction-sheet";
import { deleteDream } from "../actions";
import { ownerLabel } from "../board";
import { categoryInfo, DREAM_STATUS_LABELS, horizonInfo } from "../labels";
import type { DreamItem, DreamsBoardData } from "../types";
import { DreamCover } from "./dream-cover";
import { DreamForm } from "./dream-form";
import { DreamLifecycle } from "./dream-lifecycle";
import { DreamReactions } from "./dream-reactions";

export function DreamDetail({
  dream,
  board,
  children,
}: {
  dream: DreamItem;
  board: Omit<DreamsBoardData, "dreams">;
  /** Status-specific sections (goal, achievement, reactions) rendered under the details */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const category = categoryInfo(dream.category);
  const CategoryIcon = category.icon;
  const isShared = board.workspaceType === "shared";
  const memberNames = Object.fromEntries(board.members.map((m) => [m.userId, m.displayName]));
  const horizon = horizonInfo(dream.horizon);

  return (
    <div className="grid gap-6">
      <Link
        href={dream.status === "achieved" ? "/sonhos?tab=achieved" : "/sonhos"}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Quadro dos Sonhos
      </Link>

      <div className="overflow-hidden rounded-2xl border bg-card">
        <DreamCover
          url={dream.status === "achieved" ? (dream.achievedUrl ?? dream.coverUrl) : dream.coverUrl}
          category={dream.category}
          alt={dream.title}
          loading="eager"
          className="max-h-[60dvh]"
          placeholderClassName="aspect-[16/9]"
        />
        <div className="grid gap-4 p-4 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight">{dream.title}</h1>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <PencilIcon aria-hidden /> Editar
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="gap-1 font-normal">
              <CategoryIcon className="size-3.5" style={{ color: category.color }} aria-hidden /> {category.label}
            </Badge>
            <Badge variant="secondary" className="font-normal">
              {horizon.label} · {horizon.hint}
            </Badge>
            {isShared ? (
              <Badge variant="outline" className="font-normal">
                {ownerLabel(dream.ownerUserId, board.currentUserId, memberNames)}
              </Badge>
            ) : null}
            <Badge className="font-normal">{DREAM_STATUS_LABELS[dream.status]}</Badge>
          </div>

          {dream.why ? (
            <blockquote className="flex gap-2 rounded-xl bg-muted/60 p-3 text-sm italic">
              <QuoteIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {dream.why}
            </blockquote>
          ) : null}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="grid gap-0.5">
              <dt className="text-muted-foreground">Custo estimado</dt>
              <dd className="font-medium tabular-nums">
                {dream.estimatedCostCents ? formatBRL(dream.estimatedCostCents) : "Não informado"}
              </dd>
            </div>
          </dl>

          <DreamLifecycle dream={dream} today={board.today} />

          {isShared ? (
            <DreamReactions
              dreamId={dream.id}
              reactions={dream.reactions}
              viewerId={board.currentUserId}
              memberNames={memberNames}
            />
          ) : null}

          {children}
        </div>
      </div>

      <ConfirmDialog
        trigger={
          <Button variant="ghost" className="justify-self-center text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2Icon aria-hidden /> Excluir sonho
          </Button>
        }
        title={`Excluir "${dream.title}"?`}
        description={
          dream.goalId
            ? "O sonho e as fotos serão apagados. A meta vinculada continua existindo em Metas."
            : "O sonho e as fotos serão apagados. Isso não pode ser desfeito."
        }
        confirmLabel="Excluir"
        successMessage="Sonho excluído"
        onConfirm={async () => {
          const result = await deleteDream(dream.id);
          if (result.ok) router.push(dream.status === "achieved" ? "/sonhos?tab=achieved" : "/sonhos");
          return result;
        }}
      />

      <TransactionSheet open={editing} onOpenChange={setEditing} title="Editar sonho" description="Altere os dados do sonho.">
        <DreamForm board={board} dream={dream} onDone={() => setEditing(false)} />
      </TransactionSheet>
    </div>
  );
}
