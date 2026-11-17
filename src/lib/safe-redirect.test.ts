import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

const SITE = "http://localhost:3000";

describe("safeNextPath", () => {
  it.each([
    ["/", "/"],
    ["/transacoes?mes=2026-11", "/transacoes?mes=2026-11"],
    ["/convite/abc123", "/convite/abc123"],
    ["http://localhost:3000/convite/abc", "/convite/abc"],
    ["http://localhost:3000", "/"],
  ])("accepts %j", (input, expected) => {
    expect(safeNextPath(input, SITE)).toBe(expected);
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "https://evil.com/convite",
    "http://localhost:3001/x",
    "javascript:alert(1)",
    "evil.com",
    "/\u0000/evil.com",
    "",
  ])("rejects %j", (input) => {
    expect(safeNextPath(input, SITE)).toBe("/");
  });

  it("rejects non-strings and uses the fallback", () => {
    expect(safeNextPath(null, SITE)).toBe("/");
    expect(safeNextPath(undefined, SITE, "/entrar")).toBe("/entrar");
  });
});
