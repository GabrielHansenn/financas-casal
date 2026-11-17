import { ChevronRightIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DreamOfWeek } from "../queries";
import { DreamCover } from "./dream-cover";
import { DreamGoalProgress } from "./dream-goal-progress";

/** Dashboard card: a different dream each week, as a reminder of what the money is for. */
export function DreamOfWeekCard({
  dream,
  hasDreams,
  isShared,
  today,
}: {
  dream: DreamOfWeek | null;
  hasDreams: boolean;
  isShared: boolean;
  today: string;
}) {
  if (!dream) {
    // Board empty: invite; only achieved dreams left: nothing to show this week
    if (hasDreams) return null;
    return (
      <Card>
        <CardContent className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <SparklesIcon className="size-5 text-primary" aria-hidden />
          </span>
          <div className="grid min-w-0 flex-1 gap-0.5">
            <p className="font-medium">{isShared ? "Qual é o primeiro sonho de vocês?" : "Qual é o seu primeiro sonho?"}</p>
            <p className="text-sm text-muted-foreground">Monte o Quadro dos Sonhos e dê um motivo para cada real guardado.</p>
          </div>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/sonhos" />}>
            Começar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden pt-0">
      <Link href={`/sonhos/${dream.id}`} className="block outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <DreamCover url={dream.coverUrl} category={dream.category} alt="" className="max-h-56" placeholderClassName="aspect-[16/7]" />
      </Link>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="grid min-w-0 gap-1">
          <p className="flex items-center gap-1 text-xs font-medium tracking-wide text-primary uppercase">
            <SparklesIcon className="size-3.5" aria-hidden /> Sonho da semana
          </p>
          <CardTitle className="text-lg leading-snug">
            <Link href={`/sonhos/${dream.id}`} className="hover:underline">
              {dream.title}
            </Link>
          </CardTitle>
        </div>
        <Link
          href="/sonhos"
          className="flex shrink-0 items-center gap-0.5 text-sm text-primary underline-offset-4 hover:underline"
        >
          Ver quadro <ChevronRightIcon className="size-4" aria-hidden />
        </Link>
      </CardHeader>
      {dream.why || dream.goal ? (
        <CardContent className="grid gap-3">
          {dream.why ? <p className="text-sm text-muted-foreground italic">“{dream.why}”</p> : null}
          {dream.status === "planning" && dream.goal ? (
            <DreamGoalProgress goal={dream.goal} status={dream.status} today={today} compact />
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
