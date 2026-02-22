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

interface UIStore {
  activeTool: ActiveTool;
  interaction: InteractionMode;
  viewport: { scale: number; x: number; y: number };
  pointer: { screenX: number; screenY: number; worldX: number; worldY: number };
  connectorSourceSelected: boolean;
  aiPanelOpen: boolean;
  setActiveTool: (tool: ActiveTool) => void;
  setInteraction: (mode: InteractionMode) => void;
  setViewport: (v: { scale: number; x: number; y: number }) => void;
  setPointer: (p: { screenX: number; screenY: number; worldX: number; worldY: number }) => void;
  setConnectorSourceSelected: (v: boolean) => void;
  setAIPanelOpen: (open: boolean) => void;
  toggleAIPanel: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeTool: "pointer",
  interaction: "idle",
  viewport: { scale: 1, x: 0, y: 0 },
  pointer: { screenX: 0, screenY: 0, worldX: 0, worldY: 0 },
  connectorSourceSelected: false,
  aiPanelOpen: false,
  setActiveTool: (activeTool) => set({ activeTool }),
  setInteraction: (interaction) => set({ interaction }),
  setViewport: (viewport) => set({ viewport }),
  setPointer: (pointer) => set({ pointer }),
  setConnectorSourceSelected: (connectorSourceSelected) => set({ connectorSourceSelected }),
  setAIPanelOpen: (aiPanelOpen) => set({ aiPanelOpen }),
  toggleAIPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),
}));
