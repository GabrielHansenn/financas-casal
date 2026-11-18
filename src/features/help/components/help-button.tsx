"use client";

import { ArrowRightIcon, CircleHelpIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TransactionSheet } from "@/features/transactions/components/transaction-sheet";
import { cn } from "@/lib/utils";
import { CONTEXT_HELP, getHelpArticle, type ContextHelpTopic } from "../content";
import { HelpArticleBody } from "./help-article";

/**
 * Discreet "?" next to a complex area (split, settlement, recurrences, dreams…). Opens the
 * explanation of that area in a sheet, with a link to the full Help page.
 */
export function HelpButton({
  topic,
  className,
  size = "default",
}: {
  topic: ContextHelpTopic;
  className?: string;
  /** "inline" fits next to a form label */
  size?: "default" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const article = getHelpArticle(CONTEXT_HELP[topic]);
  if (!article) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={`Ajuda: ${article.title}`}
        title="Como funciona?"
        className={cn(
          "shrink-0 text-muted-foreground",
          size === "inline" ? "size-8 sm:size-6" : "size-11 sm:size-8",
          className,
        )}
      >
        <CircleHelpIcon aria-hidden className={size === "inline" ? "size-4" : undefined} />
      </Button>
      <TransactionSheet open={open} onOpenChange={setOpen} title={article.title} description={article.summary}>
        <div className="grid gap-6">
          <p className="text-sm text-muted-foreground">{article.summary}</p>
          <HelpArticleBody article={article} />
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/ajuda/${article.slug}`} onClick={() => setOpen(false)} />}
            className="justify-self-start"
          >
            Ver na Ajuda <ArrowRightIcon aria-hidden />
          </Button>
        </div>
      </TransactionSheet>
    </>
  );
}
