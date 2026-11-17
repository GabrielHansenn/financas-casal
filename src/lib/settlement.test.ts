import { describe, expect, it } from "vitest";
import { computeSettlement, netBalances, simplifyDebts, type LedgerEntry } from "./settlement";

const split = (creditorId: string, debtorId: string, amountCents: number): LedgerEntry => ({
  kind: "split",
  creditorId,
  debtorId,
  amountCents,
});
const paid = (creditorId: string, debtorId: string, amountCents: number): LedgerEntry => ({
  kind: "settlement",
  creditorId,
  debtorId,
  amountCents,
});

const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe("netBalances", () => {
  it("is empty without entries", () => {
    expect(netBalances([]).size).toBe(0);
  });

  it("nets debts in both directions", () => {
    // Ana covered 300 of Bruno's share; Bruno covered 100 of Ana's
    const balances = netBalances([split("ana", "bruno", 300), split("bruno", "ana", 100)]);
    expect(balances.get("ana")).toBe(200);
    expect(balances.get("bruno")).toBe(-200);
    expect(sum(balances)).toBe(0);
  });

  it("rejects fractional or negative amounts", () => {
    expect(() => netBalances([split("a", "b", 1.5)])).toThrow(RangeError);
    expect(() => netBalances([split("a", "b", -1)])).toThrow(RangeError);
  });
});

describe("computeSettlement (two people)", () => {
  it("suggests a single payment from debtor to creditor", () => {
    expect(computeSettlement([split("ana", "bruno", 4590)]).transfers).toEqual([
      { fromUserId: "bruno", toUserId: "ana", amountCents: 4590 },
    ]);
  });

  it("a partial settlement reduces the debt", () => {
    const { transfers } = computeSettlement([split("ana", "bruno", 10000), paid("bruno", "ana", 2500)]);
    expect(transfers).toEqual([{ fromUserId: "bruno", toUserId: "ana", amountCents: 7500 }]);
  });

  it("an exact settlement leaves everyone square", () => {
    const { balances, transfers } = computeSettlement([split("ana", "bruno", 10000), paid("bruno", "ana", 10000)]);
    expect(transfers).toEqual([]);
    expect(balances.get("ana")).toBe(0);
  });

  it("overpaying flips who owes", () => {
    const { transfers } = computeSettlement([split("ana", "bruno", 1000), paid("bruno", "ana", 1500)]);
    expect(transfers).toEqual([{ fromUserId: "ana", toUserId: "bruno", amountCents: 500 }]);
  });

  it("keeps odd cents exact", () => {
    // 3 expenses of R$ 10,01 split 50/50 with the payer absorbing the odd cent: Bruno owes 500 each
    const { transfers } = computeSettlement([split("ana", "bruno", 500), split("ana", "bruno", 500), split("ana", "bruno", 500)]);
    expect(transfers[0]!.amountCents).toBe(1500);
  });
});

describe("simplifyDebts (three or more)", () => {
  it("settles a chain with fewer payments", () => {
    // a owes b 10, b owes c 10  ->  a pays c 10
    const transfers = simplifyDebts(netBalances([split("b", "a", 1000), split("c", "b", 1000)]));
    expect(transfers).toEqual([{ fromUserId: "a", toUserId: "c", amountCents: 1000 }]);
  });

  it("zeroes every balance", () => {
    const entries = [split("a", "b", 700), split("a", "c", 300), split("b", "c", 450), split("c", "d", 1234)];
    const balances = netBalances(entries);
    const transfers = simplifyDebts(balances);
    const after = new Map(balances);
    for (const t of transfers) {
      after.set(t.fromUserId, after.get(t.fromUserId)! + t.amountCents);
      after.set(t.toUserId, after.get(t.toUserId)! - t.amountCents);
      expect(t.amountCents).toBeGreaterThan(0);
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true);
    expect(transfers.length).toBeLessThanOrEqual(balances.size - 1);
  });

  it("is deterministic regardless of input order", () => {
    const entries = [split("a", "c", 500), split("b", "c", 500), split("a", "d", 500)];
    const forward = simplifyDebts(netBalances(entries));
    const backward = simplifyDebts(netBalances([...entries].reverse()));
    expect(backward).toEqual(forward);
  });
});
