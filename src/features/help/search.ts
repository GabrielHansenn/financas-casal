import type { HelpArticle, HelpBlock } from "./content";

/** Lowercase, without accents and markup: "Divisão **50/50**" -> "divisao 50/50" */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\*\*/g, "")
    .toLowerCase();
}

function blockText(block: HelpBlock): string {
  switch (block.type) {
    case "steps":
    case "list":
      return block.items.join(" ");
    case "example":
      return `${block.title ?? ""} ${block.text}`;
    default:
      return block.text;
  }
}

/**
 * Simple search: every word of the query must appear in the article (title, summary, keywords
 * or text), ignoring accents and case. Matches in the title and keywords rank first.
 */
export function searchHelp(articles: HelpArticle[], query: string): HelpArticle[] {
  const terms = normalize(query).split(/\s+/).filter((term) => term.length > 0);
  if (terms.length === 0) return [];

  const scored = articles.flatMap((article) => {
    const title = normalize(article.title);
    const keywords = normalize(article.keywords.join(" "));
    const summary = normalize(article.summary);
    const body = normalize(article.blocks.map(blockText).join(" "));
    const all = `${title} ${keywords} ${summary} ${body}`;
    if (!terms.every((term) => all.includes(term))) return [];

    const score = terms.reduce(
      (sum, term) =>
        sum + (title.includes(term) ? 4 : 0) + (keywords.includes(term) ? 3 : 0) + (summary.includes(term) ? 2 : 0) + 1,
      0,
    );
    return [{ article, score }];
  });

  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.article);
}
