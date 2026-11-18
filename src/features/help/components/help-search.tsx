"use client";

import { ChevronRightIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HELP_ARTICLES, type HelpArticle } from "../content";
import { searchHelp } from "../search";

/** Search box of the Help page. While empty, shows `children` (the sections). */
export function HelpSearch({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchHelp(HELP_ARTICLES, query), [query]);
  const searching = query.trim().length > 0;

  return (
    <div className="grid gap-6">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Busque: dividir, excluir conta, acerto…"
          aria-label="Buscar na ajuda"
          className="h-11 pr-10 pl-9 text-base"
          enterKeyHint="search"
        />
        {searching ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
            onClick={() => setQuery("")}
            aria-label="Limpar busca"
          >
            <XIcon />
          </Button>
        ) : null}
      </div>

      {searching ? (
        <section aria-live="polite" className="grid gap-2">
          <p className="text-sm text-muted-foreground">
            {results.length === 0
              ? "Nada encontrado. Tente outras palavras, como \"dividir\", \"excluir\" ou \"meta\"."
              : results.length === 1
                ? "1 resultado"
                : `${results.length} resultados`}
          </p>
          {results.length > 0 ? <ArticleLinks articles={results} /> : null}
        </section>
      ) : (
        children
      )}
    </div>
  );
}

export function ArticleLinks({ articles }: { articles: HelpArticle[] }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {articles.map((article) => (
        <li key={article.slug}>
          <Link
            href={`/ajuda/${article.slug}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors outline-none first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-medium">{article.title}</span>
              <span className="text-xs text-muted-foreground">{article.summary}</span>
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
