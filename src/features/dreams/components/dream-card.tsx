import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ownerLabel } from "../board";
import { categoryInfo, DREAM_STATUS_LABELS, horizonInfo } from "../labels";
import type { DreamItem } from "../types";
import { DreamCover } from "./dream-cover";

/** Board card: cover, title, category, horizon and (shared workspaces) whose dream it is. */
export function DreamCard({
  dream,
  viewerId,
  memberNames,
  showOwner,
  footer,
}: {
  dream: DreamItem;
  viewerId: string;
  memberNames: Record<string, string>;
  showOwner: boolean;
  /** Extra content under the card body (goal progress, reactions) */
  footer?: React.ReactNode;
}) {
  const category = categoryInfo(dream.category);
  const CategoryIcon = category.icon;

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-xs transition-shadow hover:shadow-md">
      <Link
        href={`/sonhos/${dream.id}`}
        className="block outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={`Abrir sonho: ${dream.title}`}
      >
        <DreamCover url={dream.coverUrl} category={dream.category} alt="" />
        <div className="grid gap-2 p-3">
          <h3 className="flex items-start gap-1.5 leading-snug font-medium">
            <CategoryIcon className="mt-0.5 size-4 shrink-0" style={{ color: category.color }} aria-label={category.label} />
            <span className="min-w-0 break-words">{dream.title}</span>
          </h3>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary" className="font-normal">
              {horizonInfo(dream.horizon).label}
            </Badge>
            {showOwner ? (
              <Badge variant="outline" className="font-normal">
                {ownerLabel(dream.ownerUserId, viewerId, memberNames)}
              </Badge>
            ) : null}
            {dream.status === "planning" ? (
              <Badge className={cn("font-normal")}>{DREAM_STATUS_LABELS.planning}</Badge>
            ) : null}
          </div>
        </div>
      </Link>
      {footer ? <div className="border-t px-3 py-2">{footer}</div> : null}
    </article>
  );
}
