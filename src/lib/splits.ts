// Split calculation for shared expenses. Pure, integer-only (cents), unit tested.
//
// Rounding: largest remainder method. Every member gets floor(amount * weight / totalWeight);
// the leftover cents (always fewer than the number of members) go one by one to the members
// with the largest fractional parts. Ties go to the payer first, then by user id, so the result
// is deterministic and the payer absorbs odd cents in an even split (e.g. R$ 0,01 between two).

export type SplitType = "none" | "equal" | "proportional" | "custom";

export type SplitMember = {
  userId: string;
  /** Monthly income in cents, used for proportional splits. */
  incomeCents: number | null;
};

export type Split = { userId: string; amountCents: number };

export type SplitResult =
  | { ok: true; splits: Split[]; warning?: "missing_income" }
  | { ok: false; error: SplitError };

export type SplitError =
  | "invalid_amount"
  | "no_members"
  | "payer_not_member"
  | "custom_unknown_member"
  | "custom_invalid_amount"
  | "custom_sum_mismatch";

export function computeSplits(input: {
  amountCents: number;
  splitType: SplitType;
  members: SplitMember[];
  payerId: string;
  /** Required for "custom": cents per user id. Members not listed get 0. */
  custom?: Record<string, number>;
}): SplitResult {
  const { amountCents, splitType, members, payerId } = input;

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return { ok: false, error: "invalid_amount" };
  if (splitType === "none") return { ok: true, splits: [] };
  if (members.length === 0) return { ok: false, error: "no_members" };
  if (!members.some((m) => m.userId === payerId)) return { ok: false, error: "payer_not_member" };

  if (splitType === "custom") return customSplits(amountCents, members, input.custom ?? {});

  if (splitType === "proportional") {
    const incomes = members.map((m) => m.incomeCents);
    const usable = incomes.every((income) => income !== null && income >= 0) &&
      incomes.reduce<number>((sum, income) => sum + (income ?? 0), 0) > 0;
    if (!usable) {
      // Fall back to an even split and let the UI tell the user why
      return {
        ok: true,
        splits: distribute(amountCents, members.map((m) => ({ userId: m.userId, weight: 1n })), payerId),
        warning: "missing_income",
      };
    }
    return {
      ok: true,
      splits: distribute(
        amountCents,
        members.map((m) => ({ userId: m.userId, weight: BigInt(m.incomeCents ?? 0) })),
        payerId,
      ),
    };
  }

  // equal
  return {
    ok: true,
    splits: distribute(amountCents, members.map((m) => ({ userId: m.userId, weight: 1n })), payerId),
  };
}

function customSplits(amountCents: number, members: SplitMember[], custom: Record<string, number>): SplitResult {
  const memberIds = new Set(members.map((m) => m.userId));
  for (const [userId, cents] of Object.entries(custom)) {
    if (!memberIds.has(userId)) return { ok: false, error: "custom_unknown_member" };
    if (!Number.isSafeInteger(cents) || cents < 0) return { ok: false, error: "custom_invalid_amount" };
  }
  const splits = members.map((m) => ({ userId: m.userId, amountCents: custom[m.userId] ?? 0 }));
  const total = splits.reduce((sum, s) => sum + s.amountCents, 0);
  if (total !== amountCents) return { ok: false, error: "custom_sum_mismatch" };
  return { ok: true, splits };
}

/**
 * Splits `amount` proportionally to `weight` using the largest remainder method.
 * BigInt keeps amount * weight exact (both can be large, e.g. R$ 1 bi x R$ 1 mi of income).
 */
function distribute(amount: number, parts: { userId: string; weight: bigint }[], payerId: string): Split[] {
  const total = parts.reduce((sum, p) => sum + p.weight, 0n);
  const amountBig = BigInt(amount);

  const shares = parts.map((p) => {
    const numerator = amountBig * p.weight;
    return { userId: p.userId, base: numerator / total, remainder: numerator % total };
  });

  let leftover = amountBig - shares.reduce((sum, s) => sum + s.base, 0n);

  const order = [...shares].sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    if (a.userId === payerId) return -1;
    if (b.userId === payerId) return 1;
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  });

  const extra = new Map<string, bigint>();
  for (const share of order) {
    if (leftover === 0n) break;
    extra.set(share.userId, 1n);
    leftover -= 1n;
  }

  return shares.map((s) => ({ userId: s.userId, amountCents: Number(s.base + (extra.get(s.userId) ?? 0n)) }));
}

export const SPLIT_ERROR_MESSAGES: Record<SplitError, string> = {
  invalid_amount: "Informe um valor maior que zero.",
  no_members: "Este workspace não tem membros.",
  payer_not_member: "Quem pagou precisa ser membro do workspace.",
  custom_unknown_member: "A divisão inclui alguém que não é membro.",
  custom_invalid_amount: "Os valores da divisão precisam ser positivos.",
  custom_sum_mismatch: "A soma da divisão precisa ser igual ao valor total.",
};
