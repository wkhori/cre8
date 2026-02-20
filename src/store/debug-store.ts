import { create } from "zustand";

export type InteractionMode = "idle" | "dragging" | "panning" | "selecting";
export type ActiveTool =
  | "pointer"
  | "hand"
  | "connector"
  | "place-rect"
  | "place-circle"
  | "place-text"
  | "place-sticky"
  | "draw-frame";

interface DebugStore {
  fps: number;
  frameMs: number;
  viewport: { scale: number; x: number; y: number };
  pointer: { screenX: number; screenY: number; worldX: number; worldY: number };
  objectCount: number;
  selectedId: string | null;
  interaction: InteractionMode;
  konvaNodeCount: number;
  activeTool: ActiveTool;
  connectorSourceSelected: boolean;
  setFps: (fps: number, frameMs: number) => void;
  setViewport: (v: { scale: number; x: number; y: number }) => void;
  setPointer: (p: { screenX: number; screenY: number; worldX: number; worldY: number }) => void;
  setObjectCount: (n: number) => void;
  setSelectedId: (id: string | null) => void;
  setInteraction: (mode: InteractionMode) => void;
  setKonvaNodeCount: (n: number) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setConnectorSourceSelected: (v: boolean) => void;
}

export const useDebugStore = create<DebugStore>((set) => ({
  fps: 0,
  frameMs: 0,
  viewport: { scale: 1, x: 0, y: 0 },
  pointer: { screenX: 0, screenY: 0, worldX: 0, worldY: 0 },
  objectCount: 0,
  selectedId: null,
  interaction: "idle",
  konvaNodeCount: 0,
  activeTool: "pointer",
  connectorSourceSelected: false,
  setFps: (fps, frameMs) => set({ fps, frameMs }),
  setViewport: (viewport) => set({ viewport }),
  setPointer: (pointer) => set({ pointer }),
  setObjectCount: (objectCount) => set({ objectCount }),
  setSelectedId: (selectedId) => set({ selectedId }),
  setInteraction: (interaction) => set({ interaction }),
  setKonvaNodeCount: (konvaNodeCount) => set({ konvaNodeCount }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setConnectorSourceSelected: (connectorSourceSelected) => set({ connectorSourceSelected }),
}));
