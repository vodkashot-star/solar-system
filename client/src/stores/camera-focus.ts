import { create } from "zustand";

type FocusState = {
  targetBodyId: string | null;
  isFocused: boolean;
  /** True while the camera is flying out to frame the whole solar system. */
  fitAll: boolean;
  focus: (bodyId: string) => void;
  /** Trigger a fly-out that frames every body on screen, then auto-clears. */
  fit: () => void;
  clear: () => void;
};

export const useCameraFocus = create<FocusState>((set) => ({
  targetBodyId: null,
  isFocused: false,
  fitAll: false,
  focus: (bodyId) => set({ targetBodyId: bodyId, isFocused: true, fitAll: false }),
  fit: () => set({ targetBodyId: null, isFocused: false, fitAll: true }),
  clear: () => set({ targetBodyId: null, isFocused: false, fitAll: false }),
}));
