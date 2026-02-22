/* eslint-disable @typescript-eslint/no-explicit-any */
export type Throttled<T extends (...args: any[]) => void> = T & { cancel: () => void };

export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): Throttled<T> {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: any[] | null = null;

  const flush = () => {
    timer = null;
    if (!lastArgs) return;
    const args = lastArgs;
    lastArgs = null;
    last = Date.now();
    fn(...args);
  };

  const clearPending = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
  };

  const throttled = ((...args: any[]) => {
    lastArgs = args;
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
    } else if (!timer) {
      timer = setTimeout(flush, remaining);
    }
  }) as Throttled<T>;

  throttled.cancel = clearPending;
  return throttled;
}
