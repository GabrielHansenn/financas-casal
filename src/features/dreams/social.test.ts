import { describe, expect, it } from "vitest";
import { isoWeekKey, pickDreamOfWeek, summarizeReactions, toggleReaction, type DreamReaction } from "./social";

const ANA = "aaaaaaaa-0000-0000-0000-000000000001";
const BRUNO = "bbbbbbbb-0000-0000-0000-000000000002";
const names = { [ANA]: "Ana", [BRUNO]: "Bruno" };

describe("summarizeReactions", () => {
  const reactions: DreamReaction[] = [
    { userId: BRUNO, type: "love" },
    { userId: ANA, type: "love" },
    { userId: BRUNO, type: "me_too" },
  ];

  it("counts and lists who reacted, viewer first as 'Você'", () => {
    const s = summarizeReactions(reactions, ANA, names);
    expect(s.love).toEqual({ count: 2, mine: true, names: ["Você", "Bruno"] });
    expect(s.me_too).toEqual({ count: 1, mine: false, names: ["Bruno"] });
  });

  it("handles no reactions and former members", () => {
    expect(summarizeReactions([], ANA, names).love).toEqual({ count: 0, mine: false, names: [] });
    expect(summarizeReactions([{ userId: "x", type: "love" }], ANA, names).love.names).toEqual(["Ex-membro"]);
  });
});

describe("toggleReaction", () => {
  it("adds then removes the viewer's reaction, keeping others", () => {
    const start: DreamReaction[] = [{ userId: BRUNO, type: "love" }];
    const added = toggleReaction(start, ANA, "love");
    expect(added).toHaveLength(2);
    const removed = toggleReaction(added, ANA, "love");
    expect(removed).toEqual(start);
  });
});

describe("isoWeekKey", () => {
  it("follows ISO-8601 (Monday start, Thursday rule)", () => {
    expect(isoWeekKey("2026-11-17")).toBe("2026-W47"); // Tuesday
    expect(isoWeekKey("2026-11-16")).toBe("2026-W47"); // Monday
    expect(isoWeekKey("2026-11-22")).toBe("2026-W47"); // Sunday
    expect(isoWeekKey("2026-11-23")).toBe("2026-W48");
  });

  it("handles the year boundary", () => {
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53"); // Friday: still the last week of 2026
    expect(isoWeekKey("2024-12-30")).toBe("2025-W01"); // Monday: first week of 2025
  });
});

describe("pickDreamOfWeek", () => {
  const dreams = ["d1", "d2", "d3", "d4", "d5"].map((id) => ({ id, status: "dreaming" }));
  const ws = "11111111-1111-1111-1111-111111111111";

  it("is stable during the whole week and ignores list order", () => {
    const monday = pickDreamOfWeek(dreams, ws, "2026-11-16");
    expect(pickDreamOfWeek([...dreams].reverse(), ws, "2026-11-22")).toEqual(monday);
  });

  it("changes across weeks (not always the same dream)", () => {
    const picks = new Set(
      ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26", "2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23"]
        .map((day) => pickDreamOfWeek(dreams, ws, day)?.id),
    );
    expect(picks.size).toBeGreaterThan(1);
  });

  it("never picks achieved dreams and returns null when there is nothing to pick", () => {
    const mixed = [{ id: "a", status: "achieved" }, { id: "b", status: "planning" }];
    expect(pickDreamOfWeek(mixed, ws, "2026-11-17")?.id).toBe("b");
    expect(pickDreamOfWeek([{ id: "a", status: "achieved" }], ws, "2026-11-17")).toBeNull();
    expect(pickDreamOfWeek([], ws, "2026-11-17")).toBeNull();
  });
});
