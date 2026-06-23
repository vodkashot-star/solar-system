import { create } from "zustand";
import { persist } from "zustand/middleware";
import { planetsData } from "@/data/planets";

export interface Discovery {
  planetName: string;
  timestamp: number;
}

interface SolarSystemState {
  discoveredPlanets: Discovery[];
  selectedPlanet: string | null;
  completedChallenges: string[];
  orbitalOffsets: Record<string, number>;

  discoverPlanet: (planetName: string) => void;
  setSelectedPlanet: (planetName: string | null) => void;
  isPlanetDiscovered: (planetName: string) => boolean;
  canDiscoverPlanet: (planetName: string) => boolean;
  getNextPlanetToDiscover: () => string | null;
  completeChallenge: (challengeId: string) => void;
  isChallengeCompleted: (challengeId: string) => boolean;
  resetProgress: () => void;
  validateAndFixState: () => void;
  setOrbitalOffsets: (offsets: Record<string, number>) => void;
  initializeOrbitalOffsets: () => void;
  getOrbitalOffset: (celestialObjectName: string) => number;
}

function validateDiscoveries(discoveries: Discovery[]): Discovery[] {
  if (!Array.isArray(discoveries)) {
    console.warn("Invalid discoveries data, resetting to empty array");
    return [];
  }

  const discoveryMap = new Map<string, Discovery>();
  for (const discovery of discoveries) {
    if (discovery.planetName && !discoveryMap.has(discovery.planetName)) {
      discoveryMap.set(discovery.planetName, discovery);
    }
  }

  const validDiscoveries: Discovery[] = [];

  for (let i = 0; i < planetsData.length; i++) {
    const planet = planetsData[i];
    const discovery = discoveryMap.get(planet.name);

    if (!discovery) {
      break;
    }

    validDiscoveries.push(discovery);
  }

  if (validDiscoveries.length !== discoveries.length) {
    console.warn(`Validated ${validDiscoveries.length} of ${discoveries.length} discoveries in correct order`);
  }

  return validDiscoveries;
}

export const useSolarSystem = create<SolarSystemState>()(
  persist(
    (set, get) => ({
      discoveredPlanets: [],
      selectedPlanet: null,
      completedChallenges: [],
      orbitalOffsets: {},

      discoverPlanet: (planetName: string) => {
        const state = get();
        const planet = planetsData.find(p => p.name === planetName);

        if (!planet || state.isPlanetDiscovered(planetName)) {
          return;
        }

        if (!state.canDiscoverPlanet(planetName)) {
          console.warn(`Cannot discover ${planetName} yet`);
          return;
        }

        const discovery: Discovery = {
          planetName,
          timestamp: Date.now(),
        };

        set(state => ({
          discoveredPlanets: [...state.discoveredPlanets, discovery]
        }));

        console.log(`Discovered ${planetName}!`);
      },

      setSelectedPlanet: (planetName: string | null) => {
        set({ selectedPlanet: planetName });
      },

      isPlanetDiscovered: (planetName: string): boolean => {
        const state = get();
        return state.discoveredPlanets.some(d => d.planetName === planetName);
      },

      canDiscoverPlanet: (planetName: string): boolean => {
        const state = get();
        const planetIndex = planetsData.findIndex(p => p.name === planetName);

        if (planetIndex === -1) return false;
        if (planetIndex === 0) return true;

        return state.isPlanetDiscovered(planetsData[planetIndex - 1].name);
      },

      getNextPlanetToDiscover: (): string | null => {
        const state = get();
        for (const planet of planetsData) {
          if (!state.isPlanetDiscovered(planet.name)) {
            return planet.name;
          }
        }
        return null;
      },

      completeChallenge: (challengeId: string) => {
        set(state => ({
          completedChallenges: [...state.completedChallenges, challengeId]
        }));
      },

      isChallengeCompleted: (challengeId: string): boolean => {
        const state = get();
        return state.completedChallenges.includes(challengeId);
      },

      resetProgress: () => {
        set({
          discoveredPlanets: [],
          selectedPlanet: null,
          completedChallenges: [],
        });
        console.log('Progress reset');
      },

      validateAndFixState: () => {
        const state = get();
        const validatedDiscoveries = validateDiscoveries(state.discoveredPlanets);

        if (validatedDiscoveries.length !== state.discoveredPlanets.length) {
          console.log("Validated and corrected persisted state");
          set({
            discoveredPlanets: validatedDiscoveries,
          });
        }
      },

      setOrbitalOffsets: (offsets: Record<string, number>) => {
        set({ orbitalOffsets: offsets });
      },

      initializeOrbitalOffsets: () => {
        const state = get();
        if (Object.keys(state.orbitalOffsets).length === 0) {
          const newOffsets: Record<string, number> = {};
          for (const planet of planetsData) {
            newOffsets[planet.name] = Math.random() * Math.PI * 2;
          }
          set({ orbitalOffsets: newOffsets });
        }
      },

      getOrbitalOffset: (celestialObjectName: string) => {
        const state = get();
        return state.orbitalOffsets[celestialObjectName] ?? 0;
      }
    }),
    {
      name: "solar-system-storage",
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error("Failed to rehydrate state:", error);
            return;
          }
          if (state) {
            const validatedDiscoveries = validateDiscoveries(state.discoveredPlanets);
            if (validatedDiscoveries.length !== state.discoveredPlanets.length) {
              console.log("Validated and corrected persisted state on rehydration");
              useSolarSystem.setState({
                discoveredPlanets: validatedDiscoveries,
              });
            }
          }
        };
      }
    }
  )
);
