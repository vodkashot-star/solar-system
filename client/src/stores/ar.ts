import { create } from "zustand";

export type ARScaleMode = "table" | "large" | "inner" | "outer" | "deep";

type ARState = {
  /** Whether the system has been anchored to a surface (reticle tap) */
  placed: boolean;
  setPlaced: (placed: boolean) => void;
  /** Orrery scale mode: different views of the solar system */
  scale: ARScaleMode;
  setScale: (scale: ARScaleMode) => void;
  /** Orrery motion multiplier (0 = paused) */
  speed: number;
  setSpeed: (speed: number) => void;
  /** Current simulation time (days since J2000) for astronomical positions */
  currentTime: number;
  setCurrentTime: (time: number) => void;
  /** Whether to use real astronomical positions or simplified orbits */
  useAstronomicalPositions: boolean;
  setUseAstronomicalPositions: (use: boolean) => void;
  /** Whether to show body information panels */
  showInfoPanels: boolean;
  setShowInfoPanels: (show: boolean) => void;
};

/** Shared AR session state (used by ARScene and the ARControls overlay) */
export const useAR = create<ARState>((set) => ({
  placed: false,
  setPlaced: (placed) => set({ placed }),
  scale: "table",
  setScale: (scale) => set({ scale }),
  speed: 1,
  setSpeed: (speed) => set({ speed }),
  currentTime: 0, // J2000 epoch
  setCurrentTime: (currentTime) => set({ currentTime }),
  useAstronomicalPositions: false,
  setUseAstronomicalPositions: (useAstronomicalPositions) => set({ useAstronomicalPositions }),
  showInfoPanels: false,
  setShowInfoPanels: (showInfoPanels) => set({ showInfoPanels }),
}));