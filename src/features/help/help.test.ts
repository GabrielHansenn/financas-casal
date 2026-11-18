import { describe, expect, it } from "vitest";
import { CONTEXT_HELP, getHelpArticle, HELP_ARTICLES } from "./content";
import { normalize, searchHelp } from "./search";

describe("help content", () => {
  it("has unique slugs", () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only links to articles that exist", () => {
    for (const article of HELP_ARTICLES) {
      for (const slug of article.related) {
        expect(getHelpArticle(slug), `${article.slug} -> ${slug}`).toBeDefined();
      }
    }
  });

  it("has an article for every contextual help button", () => {
    for (const slug of Object.values(CONTEXT_HELP)) {
      expect(getHelpArticle(slug), slug).toBeDefined();
    }
  });

  it("covers the questions people ask most", () => {
    for (const slug of [
      "como-excluir-uma-conta",
      "o-que-e-arquivar",
      "meu-par-ve-meus-gastos-pessoais",
      "como-funciona-o-acerto",
      "como-sair-de-um-workspace",
      "como-excluir-minha-conta",
    ]) {
      expect(getHelpArticle(slug), slug).toBeDefined();
    }
  });
});

describe("normalize", () => {
  it("drops accents, case and bold markers", () => {
    expect(normalize("Divisão **Meio a Meio**")).toBe("divisao meio a meio");
  });
});

describe("searchHelp", () => {
  it("ignores accents and case", () => {
    const results = searchHelp(HELP_ARTICLES, "DIVISAO");
    expect(results[0]?.slug).toBe("divisao-de-despesas");
  });

  it("requires every word", () => {
    const results = searchHelp(HELP_ARTICLES, "excluir categoria");
    expect(results.map((a) => a.slug)).toContain("excluir-categoria");
    expect(results.every((a) => normalize(JSON.stringify(a)).includes("categoria"))).toBe(true);
  });

  it("ranks title matches first", () => {
    expect(searchHelp(HELP_ARTICLES, "arquivar")[0]?.slug).toBe("o-que-e-arquivar");
  });

  it("finds articles by keyword", () => {
    expect(searchHelp(HELP_ARTICLES, "lgpd").map((a) => a.slug)).toContain("como-excluir-minha-conta");
  });

  it("returns nothing for an empty query or no match", () => {
    expect(searchHelp(HELP_ARTICLES, "   ")).toEqual([]);
    expect(searchHelp(HELP_ARTICLES, "xyzzy")).toEqual([]);
  });
});
