import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { HELP_SECTIONS } from "@/features/help/content";
import { HelpArticleBody } from "@/features/help/components/help-article";
import { ArticleLinks, HelpSearch } from "@/features/help/components/help-search";

export const metadata: Metadata = { title: "Ajuda" };

export default function HelpPage() {
  const [firstSteps, guide, faq] = HELP_SECTIONS;

  return (
    <>
      <PageHeader title="Ajuda" description="Como usar o Adois, com exemplos do dia a dia." />
      <HelpSearch>
        <div className="grid gap-8">
          {firstSteps ? (
            <section aria-labelledby="help-first-steps" className="grid gap-3">
              <h2 id="help-first-steps" className="text-lg font-semibold">
                {firstSteps.title}
              </h2>
              <ol className="grid gap-3 sm:grid-cols-3">
                {firstSteps.articles.map((article, index) => (
                  <li key={article.slug}>
                    <Link
                      href={`/ajuda/${article.slug}`}
                      className="grid h-full gap-1 rounded-xl border bg-card p-4 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="text-xs font-semibold text-primary">Passo {index + 1}</span>
                      <span className="font-medium">{article.title}</span>
                      <span className="text-xs text-muted-foreground">{article.summary}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {guide ? (
            <section aria-labelledby="help-guide" className="grid gap-3">
              <h2 id="help-guide" className="text-lg font-semibold">
                {guide.title}
              </h2>
              <ArticleLinks articles={guide.articles} />
            </section>
          ) : null}

          {faq ? (
            <section aria-labelledby="help-faq" className="grid gap-3">
              <h2 id="help-faq" className="text-lg font-semibold">
                {faq.title}
              </h2>
              <div className="divide-y rounded-xl border bg-card">
                {faq.articles.map((article) => (
                  <details key={article.slug} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 font-medium select-none [&::-webkit-details-marker]:hidden">
                      <span className="flex-1">{article.title}</span>
                      <ChevronDownIcon
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                        aria-hidden
                      />
                    </summary>
                    <div className="grid gap-3 px-4 pb-4">
                      <HelpArticleBody article={article} />
                      <Link
                        href={`/ajuda/${article.slug}`}
                        className="text-sm text-primary underline-offset-4 hover:underline"
                      >
                        Abrir esta resposta
                      </Link>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </HelpSearch>
    </>
  );
}
