import { describe, expect, it, vi } from "vitest";
import { throttle } from "@/lib/throttle";

describe("throttle", () => {
  it("emits immediately, then emits the latest trailing args", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000));

    const calls: number[] = [];
    const throttled = throttle((value: number) => {
      calls.push(value);
    }, 50);

    throttled(1);
    vi.advanceTimersByTime(10);
    throttled(2);
    vi.advanceTimersByTime(10);
    throttled(3);

    expect(calls).toEqual([1]);

    vi.advanceTimersByTime(50);
    expect(calls).toEqual([1, 3]);

    vi.useRealTimers();
  });

  it("does not schedule a trailing call when only one call happened", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1000));

    const calls: number[] = [];
    const throttled = throttle((value: number) => {
      calls.push(value);
    }, 50);

    throttled(7);
    vi.advanceTimersByTime(100);

    expect(calls).toEqual([7]);

    vi.useRealTimers();
  });
});
