import { describe, expect, it } from "vitest";
import { pickGradient, getTimestamp, BOARD_GRADIENTS } from "./board-utils";

describe("pickGradient", () => {
  it("returns a gradient from the palette for any board ID", () => {
    const result = pickGradient("abc123");
    expect(BOARD_GRADIENTS).toContain(result);
  });

  it("returns the same gradient for the same board ID (deterministic)", () => {
    const a = pickGradient("my-board-id");
    const b = pickGradient("my-board-id");
    expect(a).toBe(b);
  });

  it("returns different gradients for different board IDs", () => {
    // With 6 gradients, testing several IDs should produce at least 2 unique results
    const ids = ["board-1", "board-2", "board-3", "board-4", "board-5", "board-6"];
    const results = new Set(ids.map(pickGradient));
    expect(results.size).toBeGreaterThan(1);
  });

  it("handles empty string without crashing", () => {
    const result = pickGradient("");
    expect(BOARD_GRADIENTS).toContain(result);
  });

  it("handles long UUIDs", () => {
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const result = pickGradient(uuid);
    expect(BOARD_GRADIENTS).toContain(result);
  });
});

describe("getTimestamp", () => {
  it("returns the number directly for number input", () => {
    expect(getTimestamp(1700000000000)).toBe(1700000000000);
  });

  it("calls toMillis() on Firestore Timestamp-like objects", () => {
    const fakeTimestamp = { toMillis: () => 1700000000000 };
    expect(getTimestamp(fakeTimestamp)).toBe(1700000000000);
  });

  it("returns Date.now() for null", () => {
    const before = Date.now();
    const result = getTimestamp(null);
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it("returns Date.now() for undefined", () => {
    const before = Date.now();
    const result = getTimestamp(undefined);
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it("returns Date.now() for string values", () => {
    const before = Date.now();
    const result = getTimestamp("not-a-timestamp");
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it("returns Date.now() for objects without toMillis", () => {
    const before = Date.now();
    const result = getTimestamp({ seconds: 123, nanoseconds: 0 });
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it("handles zero correctly", () => {
    expect(getTimestamp(0)).toBe(0);
  });
});
