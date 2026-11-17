import { describe, expect, it } from "vitest";
import {
  centsToDecimalString,
  digitsToCents,
  formatBRL,
  formatSignedBRL,
  isValidCents,
  MAX_INPUT_CENTS,
  parseBRL,
} from "./money";

// Intl uses a non-breaking space between "R$" and the number; normalize for readable assertions.
const normalize = (text: string) => text.replace(/ /g, " ");

describe("formatBRL", () => {
  it("formats integer cents as BRL", () => {
    expect(normalize(formatBRL(123456))).toBe("R$ 1.234,56");
    expect(normalize(formatBRL(5))).toBe("R$ 0,05");
    expect(normalize(formatBRL(0))).toBe("R$ 0,00");
    expect(normalize(formatBRL(100))).toBe("R$ 1,00");
  });

  it("formats negative amounts", () => {
    expect(normalize(formatBRL(-1050))).toBe("-R$ 10,50");
  });

  it("formats large amounts exactly", () => {
    expect(normalize(formatBRL(MAX_INPUT_CENTS))).toBe("R$ 99.999.999.999,99");
  });

  it("rejects non-integer values", () => {
    expect(() => formatBRL(10.5)).toThrow(TypeError);
    expect(() => formatBRL(Number.NaN)).toThrow(TypeError);
  });
});

describe("formatSignedBRL", () => {
  it("prefixes the sign", () => {
    expect(normalize(formatSignedBRL(1000))).toBe("+R$ 10,00");
    expect(normalize(formatSignedBRL(-1000))).toBe("-R$ 10,00");
    expect(normalize(formatSignedBRL(0))).toBe("R$ 0,00");
  });
});

describe("centsToDecimalString", () => {
  it("converts with integer math", () => {
    expect(centsToDecimalString(123456)).toBe("1234,56");
    expect(centsToDecimalString(5)).toBe("0,05");
    expect(centsToDecimalString(-250)).toBe("-2,50");
    expect(centsToDecimalString(0)).toBe("0,00");
  });
});

describe("digitsToCents (ATM-style input)", () => {
  it("shifts digits into cents", () => {
    expect(digitsToCents("")).toBe(0);
    expect(digitsToCents("1")).toBe(1);
    expect(digitsToCents("12")).toBe(12);
    expect(digitsToCents("123")).toBe(123);
    expect(digitsToCents("123456")).toBe(123456);
  });

  it("ignores formatting characters and leading zeros", () => {
    expect(digitsToCents("R$ 1.234,56")).toBe(123456);
    expect(digitsToCents("000150")).toBe(150);
  });

  it("caps the number of digits", () => {
    expect(digitsToCents("99999999999999999")).toBe(MAX_INPUT_CENTS);
  });
});

describe("parseBRL", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234,5", 123450],
    ["1234", 123400],
    ["0,99", 99],
    [",5", 50],
    ["R$ 10", 1000],
    ["R$ 1.000,00", 100000],
    ["  42,00  ", 4200],
    ["-5,00", -500],
    ["-R$ 5,00", -500],
    ["12.5", 1250],
    ["12.50", 1250],
    ["1.234", 123400],
    ["1.234.567", 123456700],
  ])("parses %j as %i cents", (input, expected) => {
    expect(parseBRL(input)).toBe(expected);
  });

  it.each(["", "abc", "1,234,56", "12,345", "1.23.4", "12.345,6.7", "1..5", "R$"])(
    "rejects %j",
    (input) => {
      expect(parseBRL(input)).toBeNull();
    },
  );

  it("rejects amounts above the maximum", () => {
    expect(parseBRL("100.000.000.000,00")).toBeNull();
  });

  it("never produces floating point cents", () => {
    // 0.1 + 0.2 style pitfalls: parsing must be exact
    expect(parseBRL("0,29")).toBe(29);
    expect(parseBRL("1,15")).toBe(115);
    expect(parseBRL("4,35")).toBe(435);
    expect(isValidCents(parseBRL("1.005,57"))).toBe(true);
  });
});
