import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { getHelpArticle, HELP_ARTICLES, HELP_SECTIONS } from "@/features/help/content";
import { HelpArticleBody } from "@/features/help/components/help-article";
import { ArticleLinks } from "@/features/help/components/help-search";

// Help content is static: every article is prerendered; unknown slugs hit notFound() below.
// (dynamicParams is not available with cacheComponents.)
export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: PageProps<"/ajuda/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  return { title: article ? `${article.title} · Ajuda` : "Ajuda" };
}

export default async function HelpArticlePage({ params }: PageProps<"/ajuda/[slug]">) {
  const { slug } = await params;
  const article = getHelpArticle(slug);
  if (!article) notFound();

  const section = HELP_SECTIONS.find((s) => s.id === article.section);
  const related = article.related.flatMap((relatedSlug) => getHelpArticle(relatedSlug) ?? []);

  return (
    <article className="grid gap-6">
      <Link
        href="/ajuda"
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Ajuda
        {section ? <span className="text-muted-foreground/70">· {section.title}</span> : null}
      </Link>

      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{article.title}</h1>
        <p className="text-sm text-muted-foreground">{article.summary}</p>
      </header>

      <HelpArticleBody article={article} />

      {related.length > 0 ? (
        <section aria-labelledby="help-related" className="grid gap-3 border-t pt-6">
          <h2 id="help-related" className="font-semibold">
            Veja também
          </h2>
          <ArticleLinks articles={related} />
        </section>
      ) : null}
    </article>
  );
}
