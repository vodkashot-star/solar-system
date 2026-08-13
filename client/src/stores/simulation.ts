import { create } from "zustand";

type SimulationState = {
  /** Simulation speed multiplier (0 = paused). Mirrors SolarSystem's local state. */
  speed: number;
  setSpeed: (speed: number) => void;
};

/**
 * Simulation speed bridge — SolarSystem mirrors its speedMultiplier here so
 * Canvas children (glows, stars, orbital groups) can skip invalidate() when
 * paused, letting frameloop="demand" truly freeze the scene.
 */
export const useSimulation = create<SimulationState>((set) => ({
  speed: 1,
  setSpeed: (speed) => set({ speed }),
}));