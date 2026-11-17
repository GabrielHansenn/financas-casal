import { describe, expect, it } from "vitest";
import { computeSplits, type SplitMember, type SplitResult } from "./splits";

const ANA = "aaaaaaaa-0000-0000-0000-000000000001";
const BRUNO = "bbbbbbbb-0000-0000-0000-000000000002";
const CAIO = "cccccccc-0000-0000-0000-000000000003";

const couple = (anaIncome: number | null = 600000, brunoIncome: number | null = 400000): SplitMember[] => [
  { userId: ANA, incomeCents: anaIncome },
  { userId: BRUNO, incomeCents: brunoIncome },
];

function splitsOf(result: SplitResult): Record<string, number> {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return Object.fromEntries(result.splits.map((s) => [s.userId, s.amountCents]));
}

function total(result: SplitResult): number {
  if (!result.ok) throw new Error(result.error);
  return result.splits.reduce((sum, s) => sum + s.amountCents, 0);
}

describe("computeSplits: none", () => {
  it("returns no split rows", () => {
    expect(computeSplits({ amountCents: 1000, splitType: "none", members: couple(), payerId: ANA })).toEqual({
      ok: true,
      splits: [],
    });
  });
});

describe("computeSplits: equal", () => {
  it("splits evenly", () => {
    expect(splitsOf(computeSplits({ amountCents: 10000, splitType: "equal", members: couple(), payerId: ANA })))
      .toEqual({ [ANA]: 5000, [BRUNO]: 5000 });
  });

  it("gives the leftover cent to the payer", () => {
    expect(splitsOf(computeSplits({ amountCents: 10001, splitType: "equal", members: couple(), payerId: ANA })))
      .toEqual({ [ANA]: 5001, [BRUNO]: 5000 });
    expect(splitsOf(computeSplits({ amountCents: 10001, splitType: "equal", members: couple(), payerId: BRUNO })))
      .toEqual({ [ANA]: 5000, [BRUNO]: 5001 });
  });

  it("handles a single cent", () => {
    expect(splitsOf(computeSplits({ amountCents: 1, splitType: "equal", members: couple(), payerId: BRUNO })))
      .toEqual({ [ANA]: 0, [BRUNO]: 1 });
  });

  it("distributes leftover cents among three people deterministically", () => {
    const members = [...couple(), { userId: CAIO, incomeCents: null }];
    // 100 / 3 = 33 r1 -> payer (Caio) gets the extra cent
    expect(splitsOf(computeSplits({ amountCents: 100, splitType: "equal", members, payerId: CAIO })))
      .toEqual({ [ANA]: 33, [BRUNO]: 33, [CAIO]: 34 });
    // 101 / 3 = 33 r2 -> payer first, then lowest user id
    expect(splitsOf(computeSplits({ amountCents: 101, splitType: "equal", members, payerId: CAIO })))
      .toEqual({ [ANA]: 34, [BRUNO]: 33, [CAIO]: 34 });
  });

  it("always sums to the amount", () => {
    for (let amount = 1; amount <= 1000; amount++) {
      const members = [...couple(), { userId: CAIO, incomeCents: 0 }];
      expect(total(computeSplits({ amountCents: amount, splitType: "equal", members, payerId: BRUNO }))).toBe(amount);
    }
  });
});

describe("computeSplits: proportional", () => {
  it("splits by income (60/40)", () => {
    expect(
      splitsOf(computeSplits({ amountCents: 250000, splitType: "proportional", members: couple(), payerId: ANA })),
    ).toEqual({ [ANA]: 150000, [BRUNO]: 100000 });
  });

  it("assigns leftover cents to the largest fractional part, not blindly to the payer", () => {
    // incomes 2:1, amount 100 -> exact 66.67 / 33.33 -> Ana gets 67 even when Bruno pays
    const members = couple(200000, 100000);
    expect(splitsOf(computeSplits({ amountCents: 100, splitType: "proportional", members, payerId: BRUNO })))
      .toEqual({ [ANA]: 67, [BRUNO]: 33 });
  });

  it("breaks ties in favour of the payer", () => {
    // equal incomes behave like an even split
    const members = couple(300000, 300000);
    expect(splitsOf(computeSplits({ amountCents: 3, splitType: "proportional", members, payerId: BRUNO })))
      .toEqual({ [ANA]: 1, [BRUNO]: 2 });
  });

  it("lets a member with zero income pay nothing", () => {
    expect(
      splitsOf(computeSplits({ amountCents: 9999, splitType: "proportional", members: couple(500000, 0), payerId: ANA })),
    ).toEqual({ [ANA]: 9999, [BRUNO]: 0 });
  });

  it("falls back to equal split with a warning when an income is missing", () => {
    const result = computeSplits({ amountCents: 1001, splitType: "proportional", members: couple(600000, null), payerId: ANA });
    expect(result).toMatchObject({ ok: true, warning: "missing_income" });
    expect(splitsOf(result)).toEqual({ [ANA]: 501, [BRUNO]: 500 });
  });

  it("falls back when all incomes are zero", () => {
    const result = computeSplits({ amountCents: 100, splitType: "proportional", members: couple(0, 0), payerId: ANA });
    expect(result).toMatchObject({ ok: true, warning: "missing_income" });
  });

  it("stays exact with very large values (no float overflow)", () => {
    const amount = 9_999_999_999_999; // max input
    const members = couple(9_999_999_999_999, 1);
    const result = computeSplits({ amountCents: amount, splitType: "proportional", members, payerId: BRUNO });
    expect(total(result)).toBe(amount);
    expect(splitsOf(result)[BRUNO]).toBe(1);
  });

  it("always sums to the amount for awkward ratios", () => {
    const members = [
      { userId: ANA, incomeCents: 333333 },
      { userId: BRUNO, incomeCents: 777777 },
      { userId: CAIO, incomeCents: 123457 },
    ];
    for (let amount = 1; amount <= 2000; amount += 7) {
      expect(total(computeSplits({ amountCents: amount, splitType: "proportional", members, payerId: CAIO }))).toBe(amount);
    }
  });
});

describe("computeSplits: custom", () => {
  it("uses the given amounts", () => {
    expect(
      splitsOf(computeSplits({
        amountCents: 4550, splitType: "custom", members: couple(), payerId: ANA,
        custom: { [ANA]: 1550, [BRUNO]: 3000 },
      })),
    ).toEqual({ [ANA]: 1550, [BRUNO]: 3000 });
  });

  it("fills unlisted members with zero", () => {
    expect(
      splitsOf(computeSplits({ amountCents: 100, splitType: "custom", members: couple(), payerId: ANA, custom: { [BRUNO]: 100 } })),
    ).toEqual({ [ANA]: 0, [BRUNO]: 100 });
  });

  it("rejects sums that do not match", () => {
    expect(computeSplits({
      amountCents: 100, splitType: "custom", members: couple(), payerId: ANA, custom: { [ANA]: 50, [BRUNO]: 49 },
    })).toEqual({ ok: false, error: "custom_sum_mismatch" });
  });

  it("rejects negative, fractional and unknown entries", () => {
    const base = { amountCents: 100, splitType: "custom" as const, members: couple(), payerId: ANA };
    expect(computeSplits({ ...base, custom: { [ANA]: 150, [BRUNO]: -50 } })).toEqual({ ok: false, error: "custom_invalid_amount" });
    expect(computeSplits({ ...base, custom: { [ANA]: 50.5, [BRUNO]: 49.5 } })).toEqual({ ok: false, error: "custom_invalid_amount" });
    expect(computeSplits({ ...base, custom: { [CAIO]: 100 } })).toEqual({ ok: false, error: "custom_unknown_member" });
  });
});

describe("computeSplits: validation", () => {
  it("rejects invalid amounts", () => {
    for (const amountCents of [0, -100, 10.5, Number.NaN]) {
      expect(computeSplits({ amountCents, splitType: "equal", members: couple(), payerId: ANA }))
        .toEqual({ ok: false, error: "invalid_amount" });
    }
  });

  it("requires the payer to be a member", () => {
    expect(computeSplits({ amountCents: 100, splitType: "equal", members: couple(), payerId: CAIO }))
      .toEqual({ ok: false, error: "payer_not_member" });
  });

  it("requires members", () => {
    expect(computeSplits({ amountCents: 100, splitType: "equal", members: [], payerId: ANA }))
      .toEqual({ ok: false, error: "no_members" });
  });
});
