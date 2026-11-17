import { describe, expect, it } from "vitest";
import { buildMonthSummary, type CategoryRef } from "./summary";

const cat = (id: string, name: string): CategoryRef => ({ id, name, icon: "circle", color: "#22c55e" });
const categories = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => cat(id, id.toUpperCase()));

describe("buildMonthSummary", () => {
  it("returns zeros for an empty month", () => {
    expect(buildMonthSummary([], categories)).toEqual({ incomeCents: 0, expenseCents: 0, balanceCents: 0, slices: [] });
  });

  it("sums income and expense and sorts slices by amount", () => {
    const summary = buildMonthSummary(
      [
        { categoryId: "a", type: "expense", totalCents: 1000 },
        { categoryId: "b", type: "expense", totalCents: 3000 },
        { categoryId: "c", type: "income", totalCents: 10000 },
      ],
      categories,
    );
    expect(summary.incomeCents).toBe(10000);
    expect(summary.expenseCents).toBe(4000);
    expect(summary.balanceCents).toBe(6000);
    expect(summary.slices.map((s) => [s.name, s.cents, s.share])).toEqual([
      ["B", 3000, 0.75],
      ["A", 1000, 0.25],
    ]);
  });

  it("labels expenses without category and unknown categories as 'Sem categoria'", () => {
    const summary = buildMonthSummary([{ categoryId: null, type: "expense", totalCents: 500 }], categories);
    expect(summary.slices[0]).toMatchObject({ key: "uncategorized", name: "Sem categoria", share: 1 });
  });

  it("folds the smallest categories into 'Demais categorias'", () => {
    const rows = categories.map((c, i) => ({ categoryId: c.id, type: "expense" as const, totalCents: (i + 1) * 100 }));
    const summary = buildMonthSummary(rows, categories, 4);
    expect(summary.slices.map((s) => s.name)).toEqual(["H", "G", "F", "Demais categorias"]);
    const rest = summary.slices.at(-1)!;
    expect(rest.isRest).toBe(true);
    expect(rest.cents).toBe(100 + 200 + 300 + 400 + 500);
    // slices still add up to the total
    expect(summary.slices.reduce((sum, s) => sum + s.cents, 0)).toBe(summary.expenseCents);
  });

  it("does not fold when the number of categories equals the limit", () => {
    const rows = categories.slice(0, 4).map((c) => ({ categoryId: c.id, type: "expense" as const, totalCents: 100 }));
    expect(buildMonthSummary(rows, categories, 4).slices.some((s) => s.isRest)).toBe(false);
  });

  it("ignores transfers", () => {
    const summary = buildMonthSummary([{ categoryId: null, type: "transfer", totalCents: 999 }], categories);
    expect(summary).toMatchObject({ incomeCents: 0, expenseCents: 0, slices: [] });
  });
});
