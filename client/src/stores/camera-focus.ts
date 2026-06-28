import { create } from "zustand";
import * as THREE from "three";

type FocusState = {
  targetBodyId: string | null;
  targetPosition: THREE.Vector3;
  isFocused: boolean;
  focus: (bodyId: string, position: THREE.Vector3) => void;
  clear: () => void;
};

export const useCameraFocus = create<FocusState>((set) => ({
  targetBodyId: null,
  targetPosition: new THREE.Vector3(),
  isFocused: false,
  focus: (bodyId, position) =>
    set({ targetBodyId: bodyId, targetPosition: position.clone(), isFocused: true }),
  clear: () => set({ targetBodyId: null, isFocused: false }),
}));
