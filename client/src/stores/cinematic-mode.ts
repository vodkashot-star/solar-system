import { create } from "zustand";

type CinematicState = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
};

export const useCinematicMode = create<CinematicState>((set) => ({
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
}));
