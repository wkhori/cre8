import { type Page } from "@playwright/test";

/**
 * Inject N rectangles into the canvas via store actions.
 * Returns the time in ms it took to create all shapes.
 */
export async function injectRects(page: Page, count: number): Promise<number> {
  return page.evaluate((n: number) => {
    const store = (window as any).__cre8?.canvas;
    if (!store) throw new Error("__cre8.canvas store not found on window");
    const state = store.getState();
    const start = performance.now();
    for (let i = 0; i < n; i++) {
      const x = 100 + (i % 25) * 60;
      const y = 100 + Math.floor(i / 25) * 60;
      state.addRect(x, y);
    }
    return performance.now() - start;
  }, count);
}

/**
 * Select all shapes on the canvas.
 */
export async function selectAll(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as any).__cre8?.canvas;
    if (!store) throw new Error("__cre8.canvas store not found on window");
    store.getState().selectAll();
  });
}

/**
 * Duplicate all currently selected shapes.
 * Returns the time in ms it took.
 */
export async function duplicateSelected(page: Page): Promise<number> {
  return page.evaluate(() => {
    const store = (window as any).__cre8?.canvas;
    if (!store) throw new Error("__cre8.canvas store not found on window");
    const state = store.getState();
    const start = performance.now();
    state.duplicateShapes(state.selectedIds);
    return performance.now() - start;
  });
}

/**
 * Move all currently selected shapes by (dx, dy).
 * Returns the time in ms it took.
 */
export async function moveSelected(page: Page, dx: number, dy: number): Promise<number> {
  return page.evaluate(
    ({ dx, dy }) => {
      const store = (window as any).__cre8?.canvas;
      if (!store) throw new Error("__cre8.canvas store not found on window");
      const state = store.getState();
      const updates = state.selectedIds
        .map((id: string) => {
          const shape = state.shapes.find((s: any) => s.id === id);
          return shape ? { id, patch: { x: shape.x + dx, y: shape.y + dy } } : null;
        })
        .filter(Boolean);
      const start = performance.now();
      state.updateShapes(updates);
      return performance.now() - start;
    },
    { dx, dy }
  );
}

/**
 * Delete all shapes from the canvas.
 */
export async function clearCanvas(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as any).__cre8?.canvas;
    if (!store) throw new Error("__cre8.canvas store not found on window");
    const state = store.getState();
    state.deleteShapes(state.shapes.map((s: any) => s.id));
  });
}

/**
 * Get the current shape count from the canvas store.
 */
export async function getShapeCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const store = (window as any).__cre8?.canvas;
    if (!store) throw new Error("__cre8.canvas store not found on window");
    return store.getState().shapes.length;
  });
}
