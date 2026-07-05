import { create } from "zustand";

export const useCinematicMode = create<{
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}>((set) => ({
  enabled: false,
  setEnabled: (v) => set({ enabled: v }),
}));
