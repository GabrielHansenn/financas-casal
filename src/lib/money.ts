// Money helpers. All amounts are integer cents; floats are never used for money.
// Conversion to/from human-readable BRL only happens at the UI boundary.

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Upper bound for user-entered amounts: R$ 99.999.999.999,99 (13 digits), well within
// Number.MAX_SAFE_INTEGER and Postgres bigint.
export const MAX_INPUT_CENTS = 9_999_999_999_999;

export function isValidCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function assertCents(cents: number): void {
  if (!isValidCents(cents)) {
    throw new TypeError(`Expected integer cents, got ${String(cents)}`);
  }
}

/** Formats integer cents as BRL, e.g. 123456 -> "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  assertCents(cents);
  // Dividing by 100 for display only is safe: the result is never stored or summed.
  return brlFormatter.format(cents / 100);
}

/** Formats cents with an explicit sign, e.g. "+R$ 10,00" / "-R$ 10,00". */
export function formatSignedBRL(cents: number): string {
  assertCents(cents);
  if (cents === 0) return formatBRL(0);
  const sign = cents > 0 ? "+" : "-";
  return `${sign}${formatBRL(Math.abs(cents))}`;
}

/**
 * Converts cents to the plain decimal string used in edit fields, e.g. 123456 -> "1234,56".
 * Uses integer math only.
 */
export function centsToDecimalString(cents: number): string {
  assertCents(cents);
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const integerPart = Math.trunc(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${integerPart},${fraction}`;
}

/**
 * ATM-style input: every typed digit shifts the value left, so "1", "12", "123"
 * become 1, 12 and 123 cents (R$ 0,01 / R$ 0,12 / R$ 1,23). Non-digits are ignored.
 * Returns 0 for empty input; extra digits beyond the maximum are dropped.
 */
export function digitsToCents(input: string): number {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  if (digits === "") return 0;
  const limited = digits.slice(0, String(MAX_INPUT_CENTS).length);
  return Number.parseInt(limited, 10);
}

/**
 * Parses a free-form BRL amount typed or pasted by the user into cents.
 * Accepts "1.234,56", "1234,56", "1234,5", "1234", "R$ 10", "-5,00" and also "12.50".
 * Returns null when the text is not an unambiguous amount.
 */
export function parseBRL(input: string): number | null {
  let text = input.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (text === "") return null;

  let negative = false;
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1).replace(/^R\$/i, "");
  }

  let integerPart: string;
  let fractionPart = "";

  if (text.includes(",")) {
    // Comma is the decimal separator; dots are thousands separators.
    const commaIndex = text.lastIndexOf(",");
    integerPart = text.slice(0, commaIndex);
    fractionPart = text.slice(commaIndex + 1);
    if (integerPart.includes(",")) return null;
    if (integerPart.includes(".")) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(integerPart)) return null;
      integerPart = integerPart.replace(/\./g, "");
    }
  } else if (text.includes(".")) {
    // Only dots: "1.234" / "1.234.567" are thousands; "12.5" / "12.50" are decimals.
    if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
      integerPart = text.replace(/\./g, "");
    } else if (/^\d+\.\d{1,2}$/.test(text)) {
      [integerPart, fractionPart] = text.split(".") as [string, string];
    } else {
      return null;
    }
  } else {
    integerPart = text;
  }

  if (integerPart === "") integerPart = "0";
  if (!/^\d+$/.test(integerPart) || !/^\d{0,2}$/.test(fractionPart)) return null;

  const cents =
    Number.parseInt(integerPart, 10) * 100 + Number.parseInt(fractionPart.padEnd(2, "0"), 10);

  if (!Number.isSafeInteger(cents) || cents > MAX_INPUT_CENTS) return null;
  return negative ? -cents : cents;
}
