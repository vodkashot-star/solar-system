import { BODIES } from "./bodies";

export type OrreryMoon = {
  id: string;
  name: string;
  /** Orbit radius from parent body, meters */
  orbitRadius: number;
  /** Visual radius, meters */
  visualRadius: number;
  /** Visual orbital speed, rad/s at speed 1 */
  orbitSpeed: number;
  /** Axial tilt, radians */
  tilt: number;
  /** Orbital eccentricity (Keplerian focus orbits) */
  eccentricity: number;
  /** Fallback color */
  color: string;
  /** Full GLB (used in Focus mode) */
  glbUrl?: string;
};

export type OrreryBody = {
  id: string;
  name: string;
  /** Orbit radius from the sun, meters (0 for the sun) */
  orbitRadius: number;
  /** Visual radius, meters */
  visualRadius: number;
  /** Visual orbital speed, rad/s at speed 1 */
  orbitSpeed: number;
  /** Visual spin speed, rad/s */
  spinSpeed: number;
  /** Axial tilt, radians */
  tilt: number;
  /** Initial orbital angle, radians */
  phase: number;
  /** Fallback color */
  color: string;
  /** Full GLB (used in Focus mode) */
  glbUrl?: string;
  hasRings?: boolean;
  /** Moons rendered as instanced dots in Orrery, full bodies in Focus mode */
  moons: OrreryMoon[];
};

const glbOf = (id: string) => BODIES.find((b) => b.id === id)?.glbUrl;

/** Tabletop orrery: ~0.5 m system diameter; LARGE scales everything ×4 (~2 m) */
export const ORRERY_SCALE = { table: 1, large: 4 } as const;
export type OrreryScale = keyof typeof ORRERY_SCALE;

/** Sun radius in meters at tabletop scale */
export const ORRERY_SUN_RADIUS = 0.014;

export const ORRERY_PLANETS: OrreryBody[] = [
  {
    id: "mercury",
    name: "Mercury",
    orbitRadius: 0.032,
    visualRadius: 0.004,
    orbitSpeed: 1.2,
    spinSpeed: 0.1,
    tilt: 0.03,
    phase: 0.3,
    color: "#a8a29e",
    glbUrl: glbOf("mercury"),
    moons: [],
  },
  {
    id: "venus",
    name: "Venus",
    orbitRadius: 0.048,
    visualRadius: 0.006,
    orbitSpeed: 0.9,
    spinSpeed: -0.04,
    tilt: 3.09,
    phase: 1.1,
    color: "#e0c097",
    glbUrl: glbOf("venus"),
    moons: [],
  },
  {
    id: "earth",
    name: "Earth",
    orbitRadius: 0.066,
    visualRadius: 0.0065,
    orbitSpeed: 0.75,
    spinSpeed: 0.3,
    tilt: 0.41,
    phase: 2.0,
    color: "#5b9bd5",
    glbUrl: glbOf("earth"),
    moons: [
      {
        id: "moon",
        name: "Moon",
        orbitRadius: 0.014,
        visualRadius: 0.002,
        orbitSpeed: 2.1,
        tilt: 0.09,
        eccentricity: 0.0549,
        color: "#c9c9c9",
        glbUrl: glbOf("moon"),
      },
    ],
  },
  {
    id: "mars",
    name: "Mars",
    orbitRadius: 0.086,
    visualRadius: 0.005,
    orbitSpeed: 0.6,
    spinSpeed: 0.25,
    tilt: 0.44,
    phase: 2.8,
    color: "#c1440e",
    glbUrl: glbOf("mars"),
    moons: [
      {
        id: "phobos", name: "Phobos", orbitRadius: 0.009, visualRadius: 0.001, orbitSpeed: 2.8, tilt: 0,
        eccentricity: 0.0151, color: "#8d8376" },
      {
        id: "deimos", name: "Deimos", orbitRadius: 0.013, visualRadius: 0.0009, orbitSpeed: 2.2, tilt: 0.2,
        eccentricity: 0.0003, color: "#9a948c" },
    ],
  },
  {
    id: "jupiter",
    name: "Jupiter",
    orbitRadius: 0.13,
    visualRadius: 0.014,
    orbitSpeed: 0.35,
    spinSpeed: 0.4,
    tilt: 0.05,
    phase: 3.7,
    color: "#d2a679",
    glbUrl: glbOf("jupiter"),
    moons: [
      {
        id: "io", name: "Io", orbitRadius: 0.02, visualRadius: 0.0022, orbitSpeed: 3.2, tilt: 0,
        eccentricity: 0.0041, color: "#e6d27a" },
      {
        id: "europa", name: "Europa", orbitRadius: 0.028, visualRadius: 0.0019, orbitSpeed: 2.6, tilt: 0,
        eccentricity: 0.009, color: "#d8cfc0" },
      {
        id: "ganymede", name: "Ganymede", orbitRadius: 0.038, visualRadius: 0.0032, orbitSpeed: 2.0, tilt: 0.1,
        eccentricity: 0.0013, color: "#a09a8c" },
      {
        id: "callisto", name: "Callisto", orbitRadius: 0.05, visualRadius: 0.0029, orbitSpeed: 1.6, tilt: 0.1,
        eccentricity: 0.0074, color: "#8f8a7e" },
    ],
  },
  {
    id: "saturn",
    name: "Saturn",
    orbitRadius: 0.175,
    visualRadius: 0.0125,
    orbitSpeed: 0.28,
    spinSpeed: 0.35,
    tilt: 0.47,
    phase: 4.5,
    color: "#e8d8a0",
    glbUrl: glbOf("saturn"),
    hasRings: true,
    moons: [
      {
        id: "titan", name: "Titan", orbitRadius: 0.035, visualRadius: 0.0031, orbitSpeed: 1.8, tilt: 0.3,
        eccentricity: 0.0288, color: "#e0a95e" },
    ],
  },
  {
    id: "uranus",
    name: "Uranus",
    orbitRadius: 0.215,
    visualRadius: 0.0095,
    orbitSpeed: 0.2,
    spinSpeed: 0.2,
    tilt: 1.71,
    phase: 5.3,
    color: "#9ed5e8",
    glbUrl: glbOf("uranus"),
    moons: [],
  },
  {
    id: "neptune",
    name: "Neptune",
    orbitRadius: 0.25,
    visualRadius: 0.009,
    orbitSpeed: 0.16,
    spinSpeed: 0.22,
    tilt: 0.49,
    phase: 6.1,
    color: "#4a6fd4",
    glbUrl: glbOf("neptune"),
    moons: [
      {
        id: "triton", name: "Triton", orbitRadius: 0.028, visualRadius: 0.0019, orbitSpeed: 2.0, tilt: 0,
        eccentricity: 0.00002, color: "#b8c4d0" },
    ],
  },
];

/** Bodies with a GLB usable in Focus mode: planets + any body carrying a model */
export const FOCUS_GLB_IDS = new Set(
  BODIES.filter((b) => b.glbUrl).map((b) => b.id),
);