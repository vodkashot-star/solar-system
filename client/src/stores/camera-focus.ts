import { create } from "zustand";

type FocusState = {
  targetBodyId: string | null;
  isFocused: boolean;
  focus: (bodyId: string) => void;
  clear: () => void;
};

export const useCameraFocus = create<FocusState>((set) => ({
  targetBodyId: null,
  isFocused: false,
  focus: (bodyId) => set({ targetBodyId: bodyId, isFocused: true }),
  clear: () => set({ targetBodyId: null, isFocused: false }),
}));
