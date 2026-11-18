import { describe, expect, it } from "vitest";
import { referenceErrorMessage } from "./db-errors";
import { plural } from "./plural";

describe("plural", () => {
  it("uses the singular for exactly one", () => {
    expect(plural(1, "transação", "transações")).toBe("1 transação");
  });

  it("uses the plural for zero and many, with pt-BR thousands", () => {
    expect(plural(0, "transação", "transações")).toBe("0 transações");
    expect(plural(1234, "transação", "transações")).toBe("1.234 transações");
  });

  it("uses the zero text when given", () => {
    expect(plural(0, "transação", "transações", "nenhuma transação")).toBe("nenhuma transação");
  });
});

describe("referenceErrorMessage", () => {
  it("maps the trigger messages", () => {
    expect(referenceErrorMessage({ code: "23514", message: "account is archived" })).toMatch(/conta está arquivada/);
    expect(referenceErrorMessage({ code: "23514", message: "category is archived" })).toMatch(/categoria está arquivada/);
    expect(referenceErrorMessage({ code: "23514", message: "category type does not match" })).toMatch(/não combina/);
  });

  it("ignores other errors", () => {
    expect(referenceErrorMessage({ code: "23514", message: "splits sum (1) does not match" })).toBeNull();
    expect(referenceErrorMessage({ code: "23503", message: "account is archived" })).toBeNull();
    expect(referenceErrorMessage(null)).toBeNull();
  });
});
