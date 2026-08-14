// Real astronomical values (Earth = 1 for relative comparisons)
export type AstronomicalProperties = {
  mass: number; // Earth masses
  radius: number; // Earth radii
  density: number; // g/cm³
  gravity: number; // m/s²
  temperature: number; // Kelvin
  orbitalPeriod: number; // Earth days
  semiMajorAxis: number; // AU
  eccentricity: number; // 0-1
  inclination: number; // degrees
  rotationPeriod: number; // Earth hours
  axialTilt: number; // degrees
};

// AI Analysis results
export type AIAnalysis = {
  classification: string;
  confidence: number;
  uncertainty: number;
  alternatives: Array<{ type: string; score: number }>;
  features: Array<{ name: string; value: number; importance: number }>;
  similarObjects: Array<{ bodyId: string; similarity: number }>;
};

export type BodyType = "star" | "planet" | "dwarfPlanet" | "asteroid" | "comet" | "interstellar" | "spacecraft";

export const BODY_TYPE_COLORS: Record<BodyType, string> = {
  star: "#ffd700",
  planet: "#4fc3f7",
  dwarfPlanet: "#ffb74d",
  asteroid: "#9e9e9e",
  comet: "#66bb6a",
  interstellar: "#ce93d8",
  spacecraft: "#26c6da",
};

export type Body = {
  id: string;
  type: BodyType;
  name: string;
  /** Visual radius in scene units */
  visualRadius: number;
  /** Orbit radius from sun, 0 for sun itself */
  orbit: number;
  /** Radians per second around the sun */
  orbitSpeed: number;
  /** Radians per second on own axis */
  spinSpeed: number;
  /** Axial tilt in radians */
  tilt: number;
  /** Short fact for HUD */
  fact: string;
  /** Initial orbital angle in radians */
  phase: number;
  /** Fallback color if no GLB yet */
  color: string;
  /** Optional GLB url (set once assets uploaded) */
  glbUrl?: string;
  /** Whether this body has visible rings (e.g. Saturn) */
  hasRings?: boolean;
  /** Real astronomical data */
  properties: AstronomicalProperties;
  /** AI classification results */
  aiAnalysis?: AIAnalysis;
  /** For spacecraft: ID of the parent body they orbit (e.g. "mars") */
  parentBody?: string;
  /** Visual-orbit eccentricity override. Falls back to properties.eccentricity
   *  when unset, so real astronomical data stays intact for the info panels
   *  while the scene can exaggerate/compress orbits to fit the visual scale. */
  eccentricity?: number;
  /** For spacecraft: mission metadata rendered in the detail modal */
  missionInfo?: MissionInfo;
};

export type MissionInfo = {
  /** Mission operator, e.g. "NASA JPL" */
  agency: string;
  /** Launch year */
  launched: number;
  /** Mission target description, e.g. "Mars surface — Gale Crater" */
  target: string;
  /** Current operational status */
  status: "Active" | "Historical" | "Lost";
  /** Short mission description (1–2 sentences) */
  description: string;
};

import sunGlb from "@/assets/solar/sun.glb.asset.json";
import mercuryGlb from "@/assets/solar/mercury.glb.asset.json";
import venusGlb from "@/assets/solar/venus.glb.asset.json";
import earthGlb from "@/assets/solar/earth.glb.asset.json";
import marsGlb from "@/assets/solar/mars.glb.asset.json";
import jupiterGlb from "@/assets/solar/jupiter.glb.asset.json";
import saturnGlb from "@/assets/solar/saturn.glb.asset.json";
import uranusGlb from "@/assets/solar/uranus.glb.asset.json";
import neptuneGlb from "@/assets/solar/neptune.glb.asset.json";
import moonGlb from "@/assets/solar/moon.glb.asset.json";
import plutoGlb from "@/assets/solar/pluto.glb.asset.json";
import ceresGlb from "@/assets/solar/ceres.glb.asset.json";
import erisGlb from "@/assets/solar/eris.glb.asset.json";
import haumeaGlb from "@/assets/solar/haumea.glb.asset.json";
import makemakeGlb from "@/assets/solar/makemake.glb.asset.json";
import gonggongGlb from "@/assets/solar/gonggong.glb.asset.json";
import orcusGlb from "@/assets/solar/orcus.glb.asset.json";
import bennuGlb from "@/assets/solar/bennu.glb.asset.json";
import itokawaGlb from "@/assets/solar/itokawa.glb.asset.json";
import erosGlb from "@/assets/solar/eros.glb.asset.json";
import curiosityGlb from "@/assets/solar/curiosity.glb.asset.json";
import cassiniGlb from "@/assets/solar/cassini.glb.asset.json";
import hubbleGlb from "@/assets/solar/hubble.glb.asset.json";
import voyagerGlb from "@/assets/solar/voyager.glb.asset.json";
import apolloLmGlb from "@/assets/solar/apollo-lm.glb.asset.json";
import jwstGlb from "@/assets/solar/jwst.glb.asset.json";
import newHorizonsGlb from "@/assets/solar/new-horizons.glb.asset.json";
import junoSpacecraftGlb from "@/assets/solar/juno-spacecraft.glb.asset.json";
import voyager2Glb from "@/assets/solar/voyager-2.glb.asset.json";

// Real astronomical data from NASA planetary fact sheets
// Mass: Earth = 1, Radius: Earth = 1, Density: g/cm³, Gravity: m/s², Temperature: Kelvin
const ASTRONOMICAL_DATA: Record<string, AstronomicalProperties> = {
  sun: {
    mass: 333000,
    radius: 109.2,
    density: 1.41,
    gravity: 274,
    temperature: 5778,
    orbitalPeriod: 0,
    semiMajorAxis: 0,
    eccentricity: 0,
    inclination: 0,
    rotationPeriod: 660, // Hours at equator
    axialTilt: 7.25
  },
  mercury: {
    mass: 0.055,
    radius: 0.383,
    density: 5.43,
    gravity: 3.7,
    temperature: 440,
    orbitalPeriod: 88,
    semiMajorAxis: 0.39,
    eccentricity: 0.205,
    inclination: 7.0,
    rotationPeriod: 1407.6,
    axialTilt: 0.034
  },
  venus: {
    mass: 0.815,
    radius: 0.949,
    density: 5.24,
    gravity: 8.87,
    temperature: 737,
    orbitalPeriod: 225,
    semiMajorAxis: 0.72,
    eccentricity: 0.007,
    inclination: 3.4,
    rotationPeriod: -5832, // Retrograde
    axialTilt: 177.4 // Retrograde
  },
  earth: {
    mass: 1,
    radius: 1,
    density: 5.51,
    gravity: 9.81,
    temperature: 288,
    orbitalPeriod: 365.25,
    semiMajorAxis: 1,
    eccentricity: 0.017,
    inclination: 0,
    rotationPeriod: 24,
    axialTilt: 23.44
  },
  mars: {
    mass: 0.107,
    radius: 0.532,
    density: 3.93,
    gravity: 3.71,
    temperature: 210,
    orbitalPeriod: 687,
    semiMajorAxis: 1.52,
    eccentricity: 0.094,
    inclination: 1.85,
    rotationPeriod: 24.6,
    axialTilt: 25.19
  },
  jupiter: {
    mass: 317.8,
    radius: 11.2,
    density: 1.33,
    gravity: 24.79,
    temperature: 165,
    orbitalPeriod: 4333,
    semiMajorAxis: 5.2,
    eccentricity: 0.049,
    inclination: 1.3,
    rotationPeriod: 9.9,
    axialTilt: 3.13
  },
  saturn: {
    mass: 95.2,
    radius: 9.45,
    density: 0.69,
    gravity: 10.44,
    temperature: 134,
    orbitalPeriod: 10759,
    semiMajorAxis: 9.58,
    eccentricity: 0.057,
    inclination: 2.49,
    rotationPeriod: 10.7,
    axialTilt: 26.73
  },
  uranus: {
    mass: 14.5,
    radius: 4.01,
    density: 1.27,
    gravity: 8.87,
    temperature: 76,
    orbitalPeriod: 30685,
    semiMajorAxis: 19.2,
    eccentricity: 0.046,
    inclination: 0.77,
    rotationPeriod: -17.2, // Retrograde
    axialTilt: 97.77 // Retrograde, effectively 82.2°
  },
  neptune: {
    mass: 17.1,
    radius: 3.88,
    density: 1.64,
    gravity: 11.15,
    temperature: 72,
    orbitalPeriod: 60190,
    semiMajorAxis: 30.1,
    eccentricity: 0.011,
    inclination: 1.77,
    rotationPeriod: 16.1,
    axialTilt: 28.32
  },
  pluto: {
    mass: 0.0022,
    radius: 0.186,
    density: 1.85,
    gravity: 0.62,
    temperature: 44,
    orbitalPeriod: 90560,
    semiMajorAxis: 39.48,
    eccentricity: 0.249,
    inclination: 17.16,
    rotationPeriod: -153.3,
    axialTilt: 122.53
  },
  ceres: {
    mass: 0.00016,
    radius: 0.074,
    density: 2.16,
    gravity: 0.28,
    temperature: 168,
    orbitalPeriod: 1682,
    semiMajorAxis: 2.77,
    eccentricity: 0.116,
    inclination: 10.59,
    rotationPeriod: 9.07,
    axialTilt: 4
  },
  eris: {
    mass: 0.0028,
    radius: 0.188,
    density: 2.3,
    gravity: 0.77,
    temperature: 42,
    orbitalPeriod: 203830,
    semiMajorAxis: 67.67,
    eccentricity: 0.441,
    inclination: 44.04,
    rotationPeriod: 14.56,
    axialTilt: 78
  },
  haumea: {
    mass: 0.00067,
    radius: 0.125,
    density: 2.6,
    gravity: 0.35,
    temperature: 50,
    orbitalPeriod: 104000,
    semiMajorAxis: 43.13,
    eccentricity: 0.195,
    inclination: 28.21,
    rotationPeriod: 3.92,
    axialTilt: 0
  },
  makemake: {
    mass: 0.00052,
    radius: 0.117,
    density: 2.1,
    gravity: 0.4,
    temperature: 40,
    orbitalPeriod: 112300,
    semiMajorAxis: 45.79,
    eccentricity: 0.159,
    inclination: 29.01,
    rotationPeriod: 22.5,
    axialTilt: 0
  },
  gonggong: {
    mass: 0.00029,
    radius: 0.097,
    density: 1.74,
    gravity: 0.18,
    temperature: 44,
    orbitalPeriod: 199840,
    semiMajorAxis: 66.89,
    eccentricity: 0.503,
    inclination: 30.87,
    rotationPeriod: 22.4,
    axialTilt: 0
  },
  orcus: {
    mass: 0.00009,
    radius: 0.072,
    density: 1.4,
    gravity: 0.2,
    temperature: 44,
    orbitalPeriod: 90440,
    semiMajorAxis: 39.42,
    eccentricity: 0.227,
    inclination: 20.59,
    rotationPeriod: 13.2,
    axialTilt: 0
  },
  vesta: {
    mass: 0.000045,
    radius: 0.042,
    density: 3.46,
    gravity: 0.22,
    temperature: 200,
    orbitalPeriod: 1325,
    semiMajorAxis: 2.36,
    eccentricity: 0.089,
    inclination: 7.14,
    rotationPeriod: 5.34,
    axialTilt: 29
  },
  pallas: {
    mass: 0.000035,
    radius: 0.042,
    density: 2.9,
    gravity: 0.18,
    temperature: 170,
    orbitalPeriod: 1684,
    semiMajorAxis: 2.77,
    eccentricity: 0.231,
    inclination: 34.84,
    rotationPeriod: 7.81,
    axialTilt: 84
  },
  juno: {
    mass: 0.000005,
    radius: 0.04,
    density: 3.15,
    gravity: 0.11,
    temperature: 163,
    orbitalPeriod: 1593,
    semiMajorAxis: 2.67,
    eccentricity: 0.256,
    inclination: 12.99,
    rotationPeriod: 7.21,
    axialTilt: 0
  },
  hygiea: {
    mass: 0.000015,
    radius: 0.037,
    density: 2.06,
    gravity: 0.1,
    temperature: 163,
    orbitalPeriod: 2034,
    semiMajorAxis: 3.14,
    eccentricity: 0.111,
    inclination: 3.83,
    rotationPeriod: 13.83,
    axialTilt: 60
  },
  astraea: {
    mass: 0.000003,
    radius: 0.019,
    density: 2.4,
    gravity: 0.03,
    temperature: 170,
    orbitalPeriod: 1510,
    semiMajorAxis: 2.58,
    eccentricity: 0.187,
    inclination: 5.37,
    rotationPeriod: 16.8,
    axialTilt: 0
  },
  apophis: {
    mass: 0.00000006,
    radius: 0.0027,
    density: 2.6,
    gravity: 0.001,
    temperature: 280,
    orbitalPeriod: 324,
    semiMajorAxis: 0.92,
    eccentricity: 0.191,
    inclination: 3.34,
    rotationPeriod: 30.5,
    axialTilt: 0
  },
  bennu: {
    mass: 0.00000001,
    radius: 0.0004,
    density: 1.19,
    gravity: 0.00006,
    temperature: 259,
    orbitalPeriod: 437,
    semiMajorAxis: 1.13,
    eccentricity: 0.204,
    inclination: 6.03,
    rotationPeriod: 4.3,
    axialTilt: 177.6
  },
  itokawa: {
    mass: 0.00000006,
    radius: 0.00026,
    density: 1.95,
    gravity: 0.0001,
    temperature: 250,
    orbitalPeriod: 557,
    semiMajorAxis: 1.32,
    eccentricity: 0.277,
    inclination: 1.62,
    rotationPeriod: 12.13,
    axialTilt: 0
  },
  eros: {
    mass: 0.0000001,
    radius: 0.001,
    density: 2.67,
    gravity: 0.005,
    temperature: 280,
    orbitalPeriod: 644,
    semiMajorAxis: 1.46,
    eccentricity: 0.223,
    inclination: 10.83,
    rotationPeriod: 5.27,
    axialTilt: 89
  },
  psyche: {
    mass: 0.00004,
    radius: 0.018,
    density: 4.5,
    gravity: 0.06,
    temperature: 200,
    orbitalPeriod: 1824,
    semiMajorAxis: 2.92,
    eccentricity: 0.134,
    inclination: 3.1,
    rotationPeriod: 4.2,
    axialTilt: 0
  },
  varda: {
    mass: 0.000004,
    radius: 0.012,
    density: 1.3,
    gravity: 0.02,
    temperature: 170,
    orbitalPeriod: 2035,
    semiMajorAxis: 3.16,
    eccentricity: 0.098,
    inclination: 15.9,
    rotationPeriod: 5.3,
    axialTilt: 0
  },
  oumuamua: {
    mass: 0.00000000005,
    radius: 0.0000008,
    density: 1.5,
    gravity: 0.00001,
    temperature: 280,
    orbitalPeriod: 0,
    semiMajorAxis: 0,
    eccentricity: 1.201,
    inclination: 122.74,
    rotationPeriod: 8.1,
    axialTilt: 0
  },
  halley: {
    mass: 0.0000000004,
    radius: 0.00009,
    density: 0.6,
    gravity: 0.0004,
    temperature: 180,
    orbitalPeriod: 27600,
    semiMajorAxis: 17.83,
    eccentricity: 0.967,
    inclination: 162.26,
    rotationPeriod: 52.8,
    axialTilt: 0
  },
  // ── Spacecraft ────────────────────────────────────────────────────────────
  curiosity: {
    mass: 1.5e-22,        // 899 kg dry mass in Earth masses
    radius: 0.0000028,   // ~1.8 m wide in Earth radii
    density: 0.9,
    gravity: 3.71,       // ambient at Mars surface
    temperature: 210,    // Mars average
    orbitalPeriod: 1.03, // Mars sol (surface, not orbiting)
    semiMajorAxis: 1.52,
    eccentricity: 0.094,
    inclination: 1.85,
    rotationPeriod: 24.6,
    axialTilt: 25.19
  },
  cassini: {
    mass: 9.7e-22,        // 2523 kg dry mass
    radius: 0.0000033,   // ~2 m wide
    density: 1.1,
    gravity: 10.44,      // ambient at Saturn
    temperature: 134,    // Saturn average
    orbitalPeriod: 0.44, // final Saturn orbit ~16 days — use fraction
    semiMajorAxis: 9.58,
    eccentricity: 0.057,
    inclination: 2.49,
    rotationPeriod: 10.7,
    axialTilt: 26.73
  },
  hubble: {
    mass: 2.0e-22,        // ~11110 kg
    radius: 0.0000021,   // ~4 m wide
    density: 1.0,
    gravity: 9.81,       // ambient at Earth orbit
    temperature: 288,    // Earth ambient
    orbitalPeriod: 0.0264, // ~95 min LEO orbit in days
    semiMajorAxis: 1.0,
    eccentricity: 0.0003,
    inclination: 28.5,
    rotationPeriod: 0.0264,
    axialTilt: 0
  },
  voyager: {
    mass: 2.6e-23,        // ~721 kg
    radius: 0.0000019,   // ~3.7 m wide
    density: 0.8,
    gravity: 0.00001,    // essentially weightless in deep space
    temperature: 40,     // outer solar system
    orbitalPeriod: 0,    // escaped solar system
    semiMajorAxis: 156,  // ~156 AU in 2024
    eccentricity: 3.8,   // hyperbolic escape trajectory
    inclination: 35.68,
    rotationPeriod: 0,
    axialTilt: 0
  },
  "apollo-lm": {
    mass: 6.8e-23,        // ~15100 kg descent stage
    radius: 0.0000024,   // ~9 m wide
    density: 0.9,
    gravity: 9.81,       // ambient at Earth/Moon
    temperature: 288,
    orbitalPeriod: 0.0748, // ~27.3 day lunar orbit — use LEO approx
    semiMajorAxis: 1.0,
    eccentricity: 0.0549,
    inclination: 5.14,
    rotationPeriod: 655.7,
    axialTilt: 6.68
  },
  jwst: {
    mass: 1.1e-22,
    radius: 0.0000030,
    density: 1.0,
    gravity: 0.0002,
    temperature: 50,
    orbitalPeriod: 365.25,
    semiMajorAxis: 1.01,
    eccentricity: 0.001,
    inclination: 0,
    rotationPeriod: 24,
    axialTilt: 0
  },
  newHorizons: {
    mass: 8.3e-23,
    radius: 0.0000037,
    density: 1.0,
    gravity: 0,
    temperature: 40,
    orbitalPeriod: 90560,
    semiMajorAxis: 39.5,
    eccentricity: 0.245,
    inclination: 2.5,
    rotationPeriod: 28.2,
    axialTilt: 0
  },
  junoSpacecraft: {
    mass: 6.2e-22,
    radius: 0.0000053,
    density: 1.0,
    gravity: 24.79,
    temperature: 130,
    orbitalPeriod: 53,
    semiMajorAxis: 5.2,
    eccentricity: 0.972,
    inclination: 90,
    rotationPeriod: 9.9,
    axialTilt: 3.1
  },
  voyager2: {
    mass: 1.3e-22,
    radius: 0.0000040,
    density: 1.0,
    gravity: 0,
    temperature: 3,
    orbitalPeriod: 115740,
    semiMajorAxis: 130,
    eccentricity: 1.06,
    inclination: 1.7,
    rotationPeriod: 17.2,
    axialTilt: 0
  },
  dragonfly: {
    mass: 8.0e-23,
    radius: 0.0000064,
    density: 0.9,
    gravity: 1.35,
    temperature: 94,
    orbitalPeriod: 16,
    semiMajorAxis: 9.58,
    eccentricity: 0.029,
    inclination: 0.3,
    rotationPeriod: 16,
    axialTilt: 27
  }
};

export const BODIES: Body[] = [
  { 
    id: "sun", 
    type: "star",
    name: "Sun", 
    visualRadius: 4, 
    orbit: 0, 
    orbitSpeed: 0, 
    spinSpeed: 0.05, 
    tilt: 0.12, 
    phase: 0, 
    color: "#ffb347", 
    glbUrl: sunGlb.url, 
    fact: "Our G-type main-sequence star — 99.86% of the system's mass.",
    properties: ASTRONOMICAL_DATA.sun
  },
  { 
    id: "mercury", 
    type: "planet",
    name: "Mercury", 
    visualRadius: 0.45, 
    orbit: 7, 
    orbitSpeed: 0.21, 
    spinSpeed: 0.02, 
    tilt: 0.03, 
    phase: 0.3, 
    color: "#a8a29e", 
    glbUrl: mercuryGlb.url, 
    fact: "Smallest planet. A year lasts just 88 Earth days.",
    properties: ASTRONOMICAL_DATA.mercury
  },
  { 
    id: "venus", 
    type: "planet",
    name: "Venus", 
    visualRadius: 0.75, 
    orbit: 9.5, 
    orbitSpeed: 0.16, 
    spinSpeed: -0.005, 
    tilt: 3.09, 
    phase: 1.1, 
    color: "#e0c097", 
    glbUrl: venusGlb.url, 
    fact: "Rotates backwards. Surface hot enough to melt lead.",
    properties: ASTRONOMICAL_DATA.venus
  },
  { 
    id: "earth", 
    type: "planet",
    name: "Earth", 
    visualRadius: 0.8, 
    orbit: 12.5, 
    orbitSpeed: 0.13, 
    spinSpeed: 0.5, 
    tilt: 0.41, 
    phase: 2.0, 
    color: "#5b9bd5", 
    glbUrl: earthGlb.url, 
    fact: "The only world known to harbor life.",
    properties: ASTRONOMICAL_DATA.earth
  },
  { 
    id: "mars", 
    type: "planet",
    name: "Mars", 
    visualRadius: 0.55, 
    orbit: 15.5, 
    orbitSpeed: 0.105, 
    spinSpeed: 0.48, 
    tilt: 0.44, 
    phase: 2.8, 
    color: "#c1440e", 
    glbUrl: marsGlb.url, 
    fact: "Home to Olympus Mons — the tallest volcano in the system.",
    properties: ASTRONOMICAL_DATA.mars
  },
  { 
    id: "jupiter", 
    type: "planet",
    name: "Jupiter", 
    visualRadius: 2.2, 
    orbit: 21, 
    orbitSpeed: 0.065, 
    spinSpeed: 1.1, 
    tilt: 0.05, 
    phase: 3.7, 
    color: "#d2a679", 
    glbUrl: jupiterGlb.url, 
    fact: "A failed star. More massive than all other planets combined.",
    properties: ASTRONOMICAL_DATA.jupiter
  },
  { 
    id: "saturn", 
    type: "planet",
    name: "Saturn", 
    visualRadius: 1.9, 
    orbit: 27, 
    orbitSpeed: 0.049, 
    spinSpeed: 1.0, 
    tilt: 0.47, 
    phase: 4.5, 
    color: "#e8d8a0", 
    glbUrl: saturnGlb.url, 
    hasRings: true,
    fact: "Famous rings span 280,000 km but are only ~10 m thick.",
    properties: ASTRONOMICAL_DATA.saturn
  },
  { 
    id: "uranus", 
    type: "planet",
    name: "Uranus", 
    visualRadius: 1.3, 
    orbit: 32, 
    orbitSpeed: 0.034, 
    spinSpeed: 0.7, 
    tilt: 1.71, 
    phase: 5.3, 
    color: "#9fd9e6", 
    glbUrl: uranusGlb.url, 
    hasRings: true, 
    fact: "Tilted on its side — its poles face the sun.",
    properties: ASTRONOMICAL_DATA.uranus
  },
  { 
    id: "neptune", 
    type: "planet",
    name: "Neptune", 
    visualRadius: 1.25, 
    orbit: 37, 
    orbitSpeed: 0.027, 
    spinSpeed: 0.72, 
    tilt: 0.49, 
    phase: 0.8, 
    color: "#3a6dd1", 
    glbUrl: neptuneGlb.url, 
    hasRings: true, 
    fact: "Supersonic winds reach 2,100 km/h — fastest in the system.",
    properties: ASTRONOMICAL_DATA.neptune
  },
  // --- Moon (orbits Earth) ---
  { 
    id: "moon", 
    type: "dwarfPlanet",
    name: "Moon", 
    visualRadius: 0.22, 
    orbit: 12.5, 
    orbitSpeed: 0.13, 
    spinSpeed: 0.0, 
    tilt: 0, 
    phase: 0, 
    color: "#aaaaaa", 
    glbUrl: moonGlb.url,
    parentBody: "earth",
    fact: "Earth's only natural satellite — tidally locked, same face always points to Earth.",
    properties: {
      mass: 0.0123,
      radius: 0.273,
      density: 3.34,
      gravity: 1.62,
      temperature: 250,
      orbitalPeriod: 27.32,
      semiMajorAxis: 0.00257, // AU
      eccentricity: 0.055,
      inclination: 5.14,
      rotationPeriod: 655.7, // hours (tidally locked)
      axialTilt: 6.68
    }
  },
  // --- Dwarf Planets ---
  { 
    id: "pluto", 
    type: "dwarfPlanet",
    name: "Pluto", 
    visualRadius: 0.35, 
    orbit: 46.5, 
    orbitSpeed: 0.0035, 
    spinSpeed: 0.04, 
    tilt: 2.14, 
    phase: 1.5, 
    color: "#bababa", 
    glbUrl: plutoGlb.url, 
    fact: "A distant world of ice and rock — reclassified as a dwarf planet in 2006.",
    properties: ASTRONOMICAL_DATA.pluto
  },
  { 
    id: "ceres", 
    type: "dwarfPlanet",
    name: "Ceres", 
    visualRadius: 0.3, 
    orbit: 17.5, 
    orbitSpeed: 0.085, 
    spinSpeed: 0.5, 
    tilt: 0.07, 
    phase: 0.7, 
    color: "#99917c", 
    glbUrl: ceresGlb.url, 
    fact: "Largest asteroid belt object — reclassified as a dwarf planet in 2006.",
    properties: ASTRONOMICAL_DATA.ceres
  },
  { 
    id: "eris", 
    type: "dwarfPlanet",
    name: "Eris", 
    visualRadius: 0.38, 
    orbit: 75, 
    orbitSpeed: 0.002, 
    spinSpeed: 0.35, 
    tilt: 1.36, 
    phase: 4.2, 
    color: "#d9d9e0", 
    glbUrl: erisGlb.url, 
    fact: "Second-largest dwarf planet — its discovery sparked Pluto's reclassification.",
    properties: ASTRONOMICAL_DATA.eris
  },
  { 
    id: "haumea", 
    type: "dwarfPlanet",
    name: "Haumea", 
    visualRadius: 0.35, 
    orbit: 50.2, 
    orbitSpeed: 0.0015, 
    spinSpeed: 1.5, 
    tilt: 0, 
    phase: 3.4, 
    color: "#b0bccc", 
    glbUrl: haumeaGlb.url, 
    fact: "Rapidly spinning dwarf planet with two moons and a ring system.",
    properties: ASTRONOMICAL_DATA.haumea
  },
  { 
    id: "makemake", 
    type: "dwarfPlanet",
    name: "Makemake", 
    visualRadius: 0.32, 
    orbit: 53, 
    orbitSpeed: 0.0015, 
    spinSpeed: 0.25, 
    tilt: 0, 
    phase: 5.9, 
    color: "#a6998c", 
    glbUrl: makemakeGlb.url, 
    fact: "A Kuiper belt dwarf planet named after the Rapanui creator god.",
    properties: ASTRONOMICAL_DATA.makemake
  },
  { 
    id: "gonggong", 
    type: "dwarfPlanet",
    name: "Gonggong", 
    visualRadius: 0.3, 
    orbit: 74.2, 
    orbitSpeed: 0.002, 
    spinSpeed: 0.25, 
    tilt: 0, 
    phase: 2.1, 
    color: "#8c8099", 
    glbUrl: gonggongGlb.url, 
    fact: "A red, icy world in the scattered disc — named for a Chinese water god.",
    properties: ASTRONOMICAL_DATA.gonggong
  },
  { 
    id: "orcus", 
    type: "dwarfPlanet",
    name: "Orcus", 
    visualRadius: 0.28, 
    orbit: 46.5, 
    orbitSpeed: 0.0035, 
    spinSpeed: 0.4, 
    tilt: 0, 
    phase: 0.4, 
    color: "#8c99a6", 
    glbUrl: orcusGlb.url, 
    fact: "A Plutino with a large moon — sometimes called the 'anti-Pluto'.",
    properties: ASTRONOMICAL_DATA.orcus
  },
  // --- Asteroids ---
  { 
    id: "vesta", 
    type: "asteroid",
    name: "Vesta", 
    visualRadius: 0.25, 
    orbit: 17.0, 
    orbitSpeed: 0.088, 
    spinSpeed: 0.5, 
    tilt: 0.51, 
    phase: 2.3, 
    color: "#8c8273", 
    fact: "Second-largest asteroid — visited by NASA's Dawn mission.",
    properties: ASTRONOMICAL_DATA.vesta
  },
  { 
    id: "pallas", 
    type: "asteroid",
    name: "Pallas", 
    visualRadius: 0.23, 
    orbit: 18.0, 
    orbitSpeed: 0.082, 
    spinSpeed: 0.6, 
    tilt: 1.47, 
    phase: 5.1, 
    color: "#7a756e", 
    fact: "Third-largest asteroid — its orbit is highly inclined at 35°.",
    properties: ASTRONOMICAL_DATA.pallas
  },
  { 
    id: "juno", 
    type: "asteroid",
    name: "Juno", 
    visualRadius: 0.2, 
    orbit: 18.4, 
    orbitSpeed: 0.080, 
    spinSpeed: 0.6, 
    tilt: 0, 
    phase: 3.8, 
    color: "#8c8073", 
    fact: "One of the first four asteroids discovered — found in 1804.",
    properties: ASTRONOMICAL_DATA.juno
  },
  { 
    id: "hygiea", 
    type: "asteroid",
    name: "Hygiea", 
    visualRadius: 0.22, 
    orbit: 19.2, 
    orbitSpeed: 0.076, 
    spinSpeed: 0.4, 
    tilt: 1.05, 
    phase: 1.9, 
    color: "#6e6b66", 
    fact: "Fourth-largest main-belt asteroid — darkest surface among the big four.",
    properties: ASTRONOMICAL_DATA.hygiea
  },
  { 
    id: "astraea", 
    type: "asteroid",
    name: "Astraea", 
    visualRadius: 0.15, 
    orbit: 18.8, 
    orbitSpeed: 0.078, 
    spinSpeed: 0.3, 
    tilt: 0, 
    phase: 0.9, 
    color: "#999180", 
    fact: "The fifth asteroid discovered — found 38 years after the first four.",
    properties: ASTRONOMICAL_DATA.astraea
  },
  { 
    id: "apophis", 
    type: "asteroid",
    name: "Apophis", 
    visualRadius: 0.12, 
    orbit: 11.5, 
    orbitSpeed: 0.135, 
    spinSpeed: 0.15, 
    tilt: 0, 
    phase: 4.7, 
    color: "#665e59", 
    fact: "A near-Earth asteroid — will make a close pass in 2029.",
    properties: ASTRONOMICAL_DATA.apophis
  },
  { 
    id: "bennu", 
    type: "asteroid",
    name: "Bennu", 
    visualRadius: 0.1, 
    orbit: 11.8, 
    orbitSpeed: 0.133, 
    spinSpeed: 0.5, 
    tilt: 3.1, 
    phase: 3.1, 
    color: "#544d47", 
    glbUrl: bennuGlb.url, 
    fact: "Target of OSIRIS-REx — returned samples to Earth in 2023.",
    properties: ASTRONOMICAL_DATA.bennu
  },
  { 
    id: "itokawa", 
    type: "asteroid",
    name: "Itokawa", 
    visualRadius: 0.08, 
    orbit: 12.2, 
    orbitSpeed: 0.130, 
    spinSpeed: 0.3, 
    tilt: 0, 
    phase: 5.5, 
    color: "#736b63", 
    glbUrl: itokawaGlb.url, 
    fact: "A rubble-pile asteroid visited by JAXA's Hayabusa mission.",
    properties: ASTRONOMICAL_DATA.itokawa
  },
  { 
    id: "eros", 
    type: "asteroid",
    name: "Eros", 
    visualRadius: 0.14, 
    orbit: 13.0, 
    orbitSpeed: 0.126, 
    spinSpeed: 0.6, 
    tilt: 1.55, 
    phase: 2.7, 
    color: "#8c8273", 
    glbUrl: erosGlb.url, 
    fact: "First asteroid ever orbited by a spacecraft — NEAR Shoemaker in 2000.",
    properties: ASTRONOMICAL_DATA.eros
  },
  { 
    id: "psyche", 
    type: "asteroid",
    name: "Psyche", 
    visualRadius: 0.18, 
    orbit: 20.0, 
    orbitSpeed: 0.073, 
    spinSpeed: 0.7, 
    tilt: 0, 
    phase: 0.6, 
    color: "#b3a699", 
    fact: "A metallic asteroid — target of NASA's Psyche mission.",
    properties: ASTRONOMICAL_DATA.psyche
  },
  { 
    id: "varda", 
    type: "asteroid",
    name: "Varda", 
    visualRadius: 0.14, 
    orbit: 46.5, 
    orbitSpeed: 0.0035, 
    spinSpeed: 0.6, 
    tilt: 0, 
    phase: 4.0, 
    color: "#736e69", 
    fact: "A binary asteroid in the Kuiper belt with a moon named Ilmarë.",
    properties: ASTRONOMICAL_DATA.varda
  },
  // --- Comets & Interstellar ---
  { 
    id: "halley", 
    type: "comet",
    name: "Halley", 
    visualRadius: 0.12, 
    orbit: 24.6, 
    orbitSpeed: 0.0065, 
    spinSpeed: 0.07, 
    tilt: 0, 
    phase: 1.2, 
    color: "#423830", 
    // Scene override: the real 0.967 eccentricity would drive the comet's
    // perihelion (0.81 units) through the sun's disc; 0.82 keeps perihelion
    // (≈4.4) just outside the sun (radius 4) while staying a dramatic comet.
    eccentricity: 0.82, 
    fact: "The most famous comet — returns every 75-76 years.",
    properties: ASTRONOMICAL_DATA.halley
  },
  { 
    id: "oumuamua", 
    type: "interstellar",
    name: "Oumuamua", 
    visualRadius: 0.08, 
    // Live hyperbolic flyby — hyperbolic eccentricity (1.201) with a modest
    // semi-major axis sweeps it through the inner system and back out again.
    // Negative phase puts it on the inbound leg: perihelion ≈72 s in at 1×.
    orbit: 26, 
    orbitSpeed: 0.022, 
    spinSpeed: 0.3, 
    tilt: 0, 
    phase: -1.6, 
    color: "#8c6673", 
    fact: "First known interstellar object to pass through our solar system.",
    properties: ASTRONOMICAL_DATA.oumuamua
  },
  // ── Spacecraft ────────────────────────────────────────────────────────────
  {
    id: "curiosity",
    type: "spacecraft",
    name: "Curiosity Rover",
    visualRadius: 0.07,
    orbit: 12.5,        // near Mars orbit radius
    orbitSpeed: 0.031,  // matches Mars roughly; OrbitalBody overrides radius
    spinSpeed: 0.0,
    tilt: 0,
    phase: 1.9,
    color: "#26c6da",
    glbUrl: curiosityGlb.url,
    parentBody: "mars",
    fact: "NASA's Curiosity rover has been exploring Gale Crater since August 2012.",
    properties: ASTRONOMICAL_DATA.curiosity,
    missionInfo: {
      agency: "NASA JPL",
      launched: 2011,
      target: "Mars surface — Gale Crater",
      status: "Active",
      description: "Curiosity is a car-sized rover exploring the habitability of Mars. It landed in Gale Crater in August 2012 and has been studying the planet's geology, climate, and potential for past microbial life ever since."
    }
  },
  {
    id: "cassini",
    type: "spacecraft",
    name: "Cassini",
    visualRadius: 0.09,
    orbit: 38.0,        // near Saturn orbit radius
    orbitSpeed: 0.017,
    spinSpeed: 0.05,
    tilt: 0,
    phase: 0.4,
    color: "#26c6da",
    glbUrl: cassiniGlb.url,
    parentBody: "saturn",
    fact: "Cassini orbited Saturn for 13 years before its Grand Finale dive in 2017.",
    properties: ASTRONOMICAL_DATA.cassini,
    missionInfo: {
      agency: "NASA / ESA / ASI",
      launched: 1997,
      target: "Saturn system",
      status: "Historical",
      description: "Cassini-Huygens was a joint NASA/ESA/ASI mission that orbited Saturn from 2004 to 2017. It discovered geysers on Enceladus, explored Titan's lakes of liquid methane, and ended with a dramatic plunge into Saturn's atmosphere."
    }
  },
  {
    id: "hubble",
    type: "spacecraft",
    name: "Hubble Space Telescope",
    visualRadius: 0.08,
    orbit: 8.5,         // near Earth orbit radius in scene
    orbitSpeed: 0.037,
    spinSpeed: 0.02,
    tilt: 0,
    phase: 3.5,
    color: "#26c6da",
    glbUrl: hubbleGlb.url,
    parentBody: "earth",
    fact: "Hubble has made over 1.5 million observations since launching in 1990.",
    properties: ASTRONOMICAL_DATA.hubble,
    missionInfo: {
      agency: "NASA / ESA",
      launched: 1990,
      target: "Low Earth orbit — deep space observation",
      status: "Active",
      description: "The Hubble Space Telescope revolutionised astronomy by providing ultra-sharp images free from Earth's atmospheric distortion. Operating since 1990, it has contributed to discoveries including the accelerating expansion of the universe and the age of the cosmos."
    }
  },
  {
    id: "voyager",
    type: "spacecraft",
    name: "Voyager 1",
    visualRadius: 0.07,
    orbit: 52.0,        // beyond Neptune — outer system
    orbitSpeed: 0.002,
    spinSpeed: 0.01,
    tilt: 0,
    phase: 2.7,
    color: "#26c6da",
    glbUrl: voyagerGlb.url,
    fact: "Voyager 1 crossed into interstellar space in 2012 — the most distant human-made object.",
    properties: ASTRONOMICAL_DATA.voyager,
    missionInfo: {
      agency: "NASA JPL",
      launched: 1977,
      target: "Jupiter, Saturn, then interstellar space",
      status: "Active",
      description: "Launched in 1977, Voyager 1 flew past Jupiter and Saturn before heading out of the solar system. In 2012 it crossed the heliopause into interstellar space, becoming the first human-made object to leave the solar system. It is still transmitting data today."
    }
  },
  {
    id: "apollo-lm",
    type: "spacecraft",
    name: "Apollo Lunar Module",
    visualRadius: 0.07,
    orbit: 8.5,         // near Earth orbit radius in scene
    orbitSpeed: 0.037,
    spinSpeed: 0.0,
    tilt: 0,
    phase: 5.2,
    color: "#26c6da",
    glbUrl: apolloLmGlb.url,
    parentBody: "earth",
    fact: "The Lunar Module carried the first humans to land on the Moon on July 20, 1969.",
    properties: ASTRONOMICAL_DATA["apollo-lm"],
    missionInfo: {
      agency: "NASA",
      launched: 1969,
      target: "Lunar surface — Sea of Tranquility",
      status: "Historical",
      description: "The Apollo Lunar Module was the spacecraft that carried Neil Armstrong and Buzz Aldrin to the Moon's surface on July 20, 1969. It was the first crewed vehicle to land on another world, fulfilling President Kennedy's challenge to reach the Moon before the end of the decade."
    }
  },
  {
    id: "jwst",
    type: "spacecraft",
    name: "James Webb Space Telescope",
    visualRadius: 0.10,
    orbit: 8.5,
    orbitSpeed: 0.0025,
    spinSpeed: 0.0,
    tilt: 0,
    phase: 1.0,
    color: "#26c6da",
    glbUrl: jwstGlb.url,
    parentBody: "earth",
    fact: "JWST observes the infrared universe from Lagrange point L2, 1.5 million km from Earth.",
    properties: ASTRONOMICAL_DATA.jwst,
    missionInfo: {
      agency: "NASA / ESA / CSA",
      launched: 2021,
      target: "Sun–Earth L2 — deep space observation",
      status: "Active",
      description: "The James Webb Space Telescope is the largest and most powerful space telescope ever built. Its 6.5-metre gold-coated mirror observes the infrared universe, peering back to the first galaxies formed after the Big Bang."
    }
  },
  {
    id: "new-horizons",
    type: "spacecraft",
    name: "New Horizons",
    visualRadius: 0.06,
    orbit: 75.0,
    orbitSpeed: 0.0015,
    spinSpeed: 0.01,
    tilt: 0,
    phase: 4.2,
    color: "#26c6da",
    glbUrl: newHorizonsGlb.url,
    fact: "New Horizons made the first flyby of Pluto in 2015, revealing a complex icy world.",
    properties: ASTRONOMICAL_DATA.newHorizons,
    missionInfo: {
      agency: "NASA APL",
      launched: 2006,
      target: "Pluto system, then Kuiper Belt (Arrokoth)",
      status: "Active",
      description: "New Horizons is the first spacecraft to explore Pluto and the Kuiper Belt. After its historic Pluto flyby in 2015, it encountered Kuiper Belt object Arrokoth in 2019, the most distant object ever visited by a spacecraft."
    }
  },
  {
    id: "juno-spacecraft",
    type: "spacecraft",
    name: "Juno",
    visualRadius: 0.08,
    orbit: 32.0,
    orbitSpeed: 0.006,
    spinSpeed: 0.02,
    tilt: 0,
    phase: 0.8,
    color: "#26c6da",
    glbUrl: junoSpacecraftGlb.url,
    parentBody: "jupiter",
    // Scene override: the real 0.972 eccentricity puts periapsis deep inside
    // Jupiter's exaggerated disc; 0.5 keeps a dramatic ellipse that just
    // grazes the surface (periapsis ≈ 1.1 × Jupiter radius).
    eccentricity: 0.5,
    fact: "Juno orbits Jupiter in a highly elliptical polar orbit, studying its composition and magnetic field.",
    properties: ASTRONOMICAL_DATA.junoSpacecraft,
    missionInfo: {
      agency: "NASA JPL",
      launched: 2011,
      target: "Jupiter polar orbit",
      status: "Active",
      description: "Juno arrived at Jupiter in 2016 and has been studying the planet's interior, atmosphere, and magnetosphere from a highly elliptical polar orbit. It has revealed Jupiter's cyclones, deep ammonia clouds, and a surprising magnetic field structure."
    }
  },
  {
    id: "voyager-2",
    type: "spacecraft",
    name: "Voyager 2",
    visualRadius: 0.07,
    orbit: 65.0,
    orbitSpeed: 0.0015,
    spinSpeed: 0.01,
    tilt: 0,
    phase: 6.0,
    color: "#26c6da",
    glbUrl: voyager2Glb.url,
    fact: "Voyager 2 is the only spacecraft to have visited Uranus and Neptune. It entered interstellar space in 2018.",
    properties: ASTRONOMICAL_DATA.voyager2,
    missionInfo: {
      agency: "NASA JPL",
      launched: 1977,
      target: "Jupiter, Saturn, Uranus, Neptune, then interstellar space",
      status: "Active",
      description: "Voyager 2 is the only spacecraft to have flown past all four gas giants. It discovered Neptune's dark spot, Uranus's tilted magnetic field, and active volcanoes on Jupiter's moon Io. It crossed into interstellar space in 2018, joining Voyager 1 beyond the heliopause."
    }
  },
  {
    id: "dragonfly",
    type: "spacecraft",
    name: "Dragonfly",
    visualRadius: 0.12,
    orbit: 38.0,
    orbitSpeed: 0.017,
    spinSpeed: 0.0,
    tilt: 0,
    phase: 2.3,
    color: "#26c6da",
    parentBody: "saturn",
    fact: "Dragonfly is a NASA rotorcraft lander destined for Saturn's moon Titan, launching in 2028.",
    properties: ASTRONOMICAL_DATA.dragonfly,
    missionInfo: {
      agency: "NASA APL",
      launched: 2028,
      target: "Titan — Saturn's largest moon",
      status: "Active",
      description: "Dragonfly is a nuclear-powered octocopter that will fly through Titan's thick nitrogen atmosphere, exploring multiple sites over 2.7 years. It will search for prebiotic chemistry and habitability on this ocean world with an Earth-like atmosphere."
    }
  },
];