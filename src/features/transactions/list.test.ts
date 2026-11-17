import { describe, expect, it } from "vitest";
import { groupByDay, parseTransactionFilters, signedAmount, summarize, transactionsHref } from "./list";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const CAT = "aaaaaaaa-0000-0000-0000-000000000001";

describe("parseTransactionFilters", () => {
  it("uses defaults when empty", () => {
    expect(parseTransactionFilters({}, "2026-11")).toEqual({ month: "2026-11", categoryId: null, accountId: null });
  });

  it("reads valid values and takes the first of repeated params", () => {
    expect(
      parseTransactionFilters({ month: ["2026-02", "2026-03"], category: CAT.toUpperCase(), account: A }, "2026-11"),
    ).toEqual({ month: "2026-02", categoryId: CAT, accountId: A });
  });

  it("ignores invalid values", () => {
    expect(
      parseTransactionFilters({ month: "2026-13", category: "x' or 1=1", account: "123" }, "2026-11"),
    ).toEqual({ month: "2026-11", categoryId: null, accountId: null });
  });
});

describe("transactionsHref", () => {
  it("omits default values", () => {
    expect(transactionsHref({ month: "2026-11", categoryId: null, accountId: null }, "2026-11")).toBe("/transacoes");
  });

  it("includes non-default values", () => {
    expect(transactionsHref({ month: "2026-10", categoryId: CAT, accountId: A }, "2026-11")).toBe(
      `/transacoes?month=2026-10&category=${CAT}&account=${A}`,
    );
  });
});

describe("signedAmount", () => {
  const transfer = { type: "transfer" as const, amountCents: 500, accountId: A, toAccountId: B };

  it("signs income and expense", () => {
    expect(signedAmount({ type: "income", amountCents: 100, accountId: A, toAccountId: null })).toBe(100);
    expect(signedAmount({ type: "expense", amountCents: 100, accountId: A, toAccountId: null })).toBe(-100);
  });

  it("treats transfers as neutral without an account filter", () => {
    expect(signedAmount(transfer)).toBe(0);
  });

  it("signs transfers relative to the filtered account", () => {
    expect(signedAmount(transfer, A)).toBe(-500);
    expect(signedAmount(transfer, B)).toBe(500);
  });
});

describe("groupByDay", () => {
  const item = (id: string, date: string, type: "income" | "expense" | "transfer", amountCents: number) => ({
    id,
    date,
    type,
    amountCents,
    accountId: A,
    toAccountId: type === "transfer" ? B : null,
  });

  it("groups by date, newest first, keeping order and summing the day", () => {
    const groups = groupByDay([
      item("1", "2026-11-17", "expense", 1000),
      item("2", "2026-11-15", "income", 5000),
      item("3", "2026-11-17", "income", 300),
      item("4", "2026-11-17", "transfer", 999),
    ]);
    expect(groups.map((g) => g.date)).toEqual(["2026-11-17", "2026-11-15"]);
    expect(groups[0]!.items.map((i) => i.id)).toEqual(["1", "3", "4"]);
    expect(groups[0]!.totalCents).toBe(-700);
    expect(groups[1]!.totalCents).toBe(5000);
  });

  it("counts transfers in the day total when filtered by account", () => {
    const groups = groupByDay([item("1", "2026-11-17", "transfer", 999)], B);
    expect(groups[0]!.totalCents).toBe(999);
  });

  it("returns no groups for an empty list", () => {
    expect(groupByDay([])).toEqual([]);
  });
});

describe("summarize", () => {
  it("sums income and expense, ignoring transfers", () => {
    expect(
      summarize([
        { type: "income", amountCents: 10000 },
        { type: "expense", amountCents: 2550 },
        { type: "expense", amountCents: 1 },
        { type: "transfer", amountCents: 99999 },
      ]),
    ).toEqual({ incomeCents: 10000, expenseCents: 2551, balanceCents: 7449 });
  });
});
