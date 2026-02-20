import { create } from "zustand";

interface DebugStore {
  fps: number;
  frameMs: number;
  setFps: (fps: number, frameMs: number) => void;
}

export const useDebugStore = create<DebugStore>((set) => ({
  fps: 0,
  frameMs: 0,
  setFps: (fps, frameMs) => set({ fps, frameMs }),
}));
