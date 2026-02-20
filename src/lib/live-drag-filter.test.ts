import { describe, expect, it } from "vitest";
import { filterLiveDragData, type LiveDragDataLike } from "@/lib/live-drag-filter";

describe("filterLiveDragData", () => {
  it("filters own user and stale entries", () => {
    const lastSeen = new Map<string, number>();
    const raw: LiveDragDataLike = {
      a: { x: 10, y: 10, uid: "u2", ts: 1000 },
      b: { x: 20, y: 20, uid: "u1", ts: 1000 },
      c: { x: 30, y: 30, uid: "u2", ts: 1 },
    };

    const result = filterLiveDragData(raw, "u1", 3999, lastSeen);
    expect(Object.keys(result)).toEqual(["a"]);
    expect(lastSeen.get("a")).toBe(1000);
  });

  it("ignores out-of-order updates by timestamp", () => {
    const lastSeen = new Map<string, number>([["a", 2000]]);
    const raw: LiveDragDataLike = {
      a: { x: 10, y: 10, uid: "u2", ts: 1500 },
    };

    const result = filterLiveDragData(raw, "u1", 2100, lastSeen);
    expect(result).toEqual({});
    expect(lastSeen.get("a")).toBe(2000);
  });

  it("ignores same-timestamp duplicate updates", () => {
    const lastSeen = new Map<string, number>([["a", 2000]]);
    const raw: LiveDragDataLike = {
      a: { x: 11, y: 11, uid: "u2", ts: 2000 },
    };

    const result = filterLiveDragData(raw, "u1", 2100, lastSeen);
    expect(result).toEqual({});
    expect(lastSeen.get("a")).toBe(2000);
  });

  it("prunes ids that are no longer present in payload", () => {
    const lastSeen = new Map<string, number>([
      ["a", 1000],
      ["b", 1000],
    ]);
    const raw: LiveDragDataLike = {
      a: { x: 10, y: 10, uid: "u2", ts: 1100 },
    };

    filterLiveDragData(raw, "u1", 1200, lastSeen);
    expect(lastSeen.has("a")).toBe(true);
    expect(lastSeen.has("b")).toBe(false);
  });
});
