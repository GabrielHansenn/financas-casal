import { describe, expect, it } from "vitest";
import {
  dreamImagePath,
  dreamsHref,
  fitWithin,
  isDreamImagePath,
  matchesFilters,
  ownerLabel,
  parseDreamFilters,
  toColumns,
} from "./board";

const WS = "11111111-1111-1111-1111-111111111111";
const DREAM = "22222222-2222-2222-2222-222222222222";
const ANA = "aaaaaaaa-0000-0000-0000-000000000001";
const BRUNO = "bbbbbbbb-0000-0000-0000-000000000002";

describe("parseDreamFilters / dreamsHref", () => {
  it("defaults to the active tab without filters", () => {
    expect(parseDreamFilters({})).toEqual({ tab: "active", category: null, horizon: null, owner: null });
    expect(dreamsHref(parseDreamFilters({}))).toBe("/sonhos");
  });

  it("reads valid values and round-trips them", () => {
    const filters = parseDreamFilters({ tab: "achieved", category: "travel", horizon: ["short", "long"], owner: ANA.toUpperCase() });
    expect(filters).toEqual({ tab: "achieved", category: "travel", horizon: "short", owner: ANA });
    expect(parseDreamFilters(Object.fromEntries(new URL(`http://x${dreamsHref(filters)}`).searchParams))).toEqual(filters);
  });

  it("ignores invalid values", () => {
    expect(parseDreamFilters({ tab: "x", category: "boat", horizon: "soon", owner: "1 or 1=1" })).toEqual({
      tab: "active", category: null, horizon: null, owner: null,
    });
    expect(parseDreamFilters({ owner: "ours" }).owner).toBe("ours");
  });
});

describe("matchesFilters", () => {
  const dream = { status: "planning" as const, category: "travel" as const, horizon: "short" as const, ownerUserId: null };
  const none = { tab: "active" as const, category: null, horizon: null, owner: null };

  it("splits tabs by status", () => {
    expect(matchesFilters(dream, none)).toBe(true);
    expect(matchesFilters({ ...dream, status: "achieved" }, none)).toBe(false);
    expect(matchesFilters({ ...dream, status: "achieved" }, { ...none, tab: "achieved" })).toBe(true);
  });

  it("filters by category, horizon and owner", () => {
    expect(matchesFilters(dream, { ...none, category: "home" })).toBe(false);
    expect(matchesFilters(dream, { ...none, horizon: "short" })).toBe(true);
    expect(matchesFilters(dream, { ...none, owner: "ours" })).toBe(true);
    expect(matchesFilters(dream, { ...none, owner: ANA })).toBe(false);
    expect(matchesFilters({ ...dream, ownerUserId: ANA }, { ...none, owner: ANA })).toBe(true);
    expect(matchesFilters({ ...dream, ownerUserId: ANA }, { ...none, owner: "ours" })).toBe(false);
  });
});

describe("ownerLabel", () => {
  it("is relative to the viewer", () => {
    const names = { [ANA]: "Ana", [BRUNO]: "Bruno" };
    expect(ownerLabel(null, ANA, names)).toBe("Nosso");
    expect(ownerLabel(ANA, ANA, names)).toBe("Meu");
    expect(ownerLabel(ANA, BRUNO, names)).toBe("De Ana");
    expect(ownerLabel("cccccccc-0000-0000-0000-000000000003", ANA, names)).toBe("De ex-membro");
  });
});

describe("image paths", () => {
  it("builds paths inside the dream folder", () => {
    expect(dreamImagePath(WS, DREAM, "cover", "webp", "abc123")).toBe(`${WS}/${DREAM}/cover-abc123.webp`);
  });

  it("rejects invalid ids and suffixes", () => {
    expect(() => dreamImagePath("x", DREAM, "cover", "webp", "abc123")).toThrow(RangeError);
    expect(() => dreamImagePath(WS, DREAM, "cover", "webp", "../../etc")).toThrow(RangeError);
  });

  it("validates a path belongs to the dream", () => {
    expect(isDreamImagePath(`${WS}/${DREAM}/cover-abc123.webp`, WS, DREAM)).toBe(true);
    expect(isDreamImagePath(`${WS}/${DREAM}/achieved-x1y2.jpg`, WS, DREAM)).toBe(true);
    expect(isDreamImagePath(`${WS}/${BRUNO}/cover-abc123.webp`, WS, DREAM)).toBe(false);
    expect(isDreamImagePath(`${WS}/${DREAM}/../x/cover-abc.webp`, WS, DREAM)).toBe(false);
    expect(isDreamImagePath(`${WS}/${DREAM}/evil.svg`, WS, DREAM)).toBe(false);
  });
});

describe("fitWithin", () => {
  it("scales down keeping the aspect ratio", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it("never upscales", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("rejects empty images", () => {
    expect(() => fitWithin(0, 100)).toThrow(RangeError);
  });
});

describe("toColumns", () => {
  it("distributes round-robin so rows keep the order", () => {
    expect(toColumns([1, 2, 3, 4, 5], 2)).toEqual([[1, 3, 5], [2, 4]]);
    expect(toColumns([1, 2], 3)).toEqual([[1], [2], []]);
    expect(toColumns([1, 2], 0)).toEqual([[1, 2]]);
  });
});
