import { describe, expect, it } from "vitest";
import { involvesFormerMember } from "./former-members";

const ana = "00000000-0000-4000-8000-000000000001";
const bruno = "00000000-0000-4000-8000-000000000002";

describe("involvesFormerMember", () => {
  it("is false when everyone is still a member", () => {
    expect(involvesFormerMember({ paidBy: ana, splitUserIds: [ana, bruno] }, [ana, bruno])).toBe(false);
  });

  it("is true when the payer left", () => {
    expect(involvesFormerMember({ paidBy: bruno, splitUserIds: [ana, bruno] }, [ana])).toBe(true);
  });

  it("is true when someone in the split left", () => {
    expect(involvesFormerMember({ paidBy: ana, splitUserIds: [ana, bruno] }, [ana])).toBe(true);
  });

  it("ignores transactions without a split (nothing to recompute)", () => {
    expect(involvesFormerMember({ paidBy: bruno, splitUserIds: [] }, [ana])).toBe(false);
  });
});
