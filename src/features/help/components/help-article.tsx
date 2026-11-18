import { LightbulbIcon, MessageSquareQuoteIcon } from "lucide-react";
import { Fragment } from "react";
import type { HelpArticle, HelpBlock } from "../content";

/** Renders text with **bold** segments. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <strong key={index} className="font-semibold text-foreground">
            {part}
          </strong>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Block({ block }: { block: HelpBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p>
          <RichText text={block.text} />
        </p>
      );
    case "h":
      return (
        <h3 className="pt-2 text-base font-semibold text-foreground">
          <RichText text={block.text} />
        </h3>
      );
    case "steps":
      return (
        <ol className="grid gap-2">
          {block.items.map((item, index) => (
            <li key={item} className="flex gap-3">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
              >
                {index + 1}
              </span>
              <span className="pt-0.5">
                <RichText text={item} />
              </span>
            </li>
          ))}
        </ol>
      );
    case "list":
      return (
        <ul className="grid list-disc gap-1.5 pl-5">
          {block.items.map((item) => (
            <li key={item}>
              <RichText text={item} />
            </li>
          ))}
        </ul>
      );
    case "example":
      return (
        <div className="grid gap-1 rounded-lg border-l-4 border-primary/60 bg-primary/5 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary uppercase">
            <MessageSquareQuoteIcon className="size-3.5" aria-hidden />
            {block.title ?? "Exemplo"}
          </p>
          <p className="text-foreground">
            <RichText text={block.text} />
          </p>
        </div>
      );
    case "tip":
      return (
        <p className="flex gap-2 rounded-lg bg-amber-500/10 px-4 py-3 text-foreground">
          <LightbulbIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <span>
            <RichText text={block.text} />
          </span>
        </p>
      );
  }
}

/** Body of a help article (title rendered by the caller). Works in server and client components. */
export function HelpArticleBody({ article }: { article: HelpArticle }) {
  return (
    <div className="grid gap-4 text-sm leading-relaxed text-muted-foreground">
      {article.blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}
