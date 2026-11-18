import { z } from "@/lib/zod";
import guide from "@/content/ajuda/guia.json";
import faq from "@/content/ajuda/perguntas-frequentes.json";
import firstSteps from "@/content/ajuda/primeiros-passos.json";

/*
 * Help content lives in src/content/ajuda/*.json (one file per section), so it can be edited
 * without touching code. Text supports **bold**. Block types:
 *   { "type": "p",       "text": "..." }              paragraph
 *   { "type": "h",       "text": "..." }              subheading
 *   { "type": "steps",   "items": ["...", "..."] }    numbered steps
 *   { "type": "list",    "items": ["...", "..."] }    bullet list
 *   { "type": "example", "title"?: "...", "text": "..." }  highlighted example
 *   { "type": "tip",     "text": "..." }              tip
 * The content is validated when the module loads, so a typo breaks the build, not the page.
 */

const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("p"), text: z.string().min(1) }),
  z.object({ type: z.literal("h"), text: z.string().min(1) }),
  z.object({ type: z.literal("steps"), items: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("list"), items: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("example"), title: z.string().optional(), text: z.string().min(1) }),
  z.object({ type: z.literal("tip"), text: z.string().min(1) }),
]);

const articleSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().min(1),
  summary: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  blocks: z.array(blockSchema).min(1),
  related: z.array(z.string()).default([]),
});

export type HelpBlock = z.infer<typeof blockSchema>;
export type HelpArticle = z.infer<typeof articleSchema> & { section: HelpSectionId };

export type HelpSectionId = "primeiros-passos" | "guia" | "perguntas-frequentes";
export type HelpSection = { id: HelpSectionId; title: string; articles: HelpArticle[] };

function parseSection(id: HelpSectionId, title: string, raw: unknown): HelpSection {
  const articles = z.array(articleSchema).parse(raw);
  return { id, title, articles: articles.map((article) => ({ ...article, section: id })) };
}

export const HELP_SECTIONS: HelpSection[] = [
  parseSection("primeiros-passos", "Primeiros passos", firstSteps),
  parseSection("guia", "Guia por área", guide),
  parseSection("perguntas-frequentes", "Perguntas frequentes", faq),
];

export const HELP_ARTICLES: HelpArticle[] = HELP_SECTIONS.flatMap((section) => section.articles);

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug);
}

/** Articles opened by the contextual "?" buttons. Kept here so a renamed slug fails the tests. */
export const CONTEXT_HELP = {
  split: "divisao-de-despesas",
  settlement: "acerto-do-casal",
  recurrences: "recorrencias",
  dreams: "quadro-dos-sonhos",
  goals: "metas",
  workspaces: "workspaces",
} as const;

export type ContextHelpTopic = keyof typeof CONTEXT_HELP;
