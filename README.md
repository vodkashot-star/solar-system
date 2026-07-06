# Solar System · Cinematic 3D Tour

A full-screen 3D solar system with a cinematic camera tour through the Sun, 8
planets, and 20+ dwarf planets, asteroids, comets, interstellar objects, and
NASA spacecraft. Rendered with high-quality GLB models. Built with React Three
Fiber, Drei, and Three.js.

---

## Features

- **Cinematic tour** — 10s solar-system establishing shot (full 360° orbit), then camera visits each body with smooth easing (5s per body, loops continuously)
- **34 GLB models** — sun + 8 planets + 20 dwarf planets/asteroids/comets +
  5 NASA spacecraft, loaded via `useGLTF` and auto-normalized to correct scale.
  Per-body loading grid shows individual progress; overlay dismisses when all
  models load or after a 15s timeout.
- **NASA spacecraft** — Curiosity Rover (Mars), Cassini (Saturn), Hubble Space
  Telescope (Earth), Voyager 1 (outer system), Apollo Lunar Module (Earth) as
  first-class bodies with their own orbits, data panels, and mission info cards.
  Models sourced from [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources)
  (public domain), available as native GLB files — no conversion needed.
- **Bloom + Stars** — emissive sun glow via `@react-three/postprocessing`,
  custom instanced star field. Bloom auto-disables when tour is paused to save
  GPU.
- **Pause / Free Look** — toggle pauses the tour and enables OrbitControls for
  manual exploration
- **Click-to-focus** — click any body to fly the camera to it; tour pauses
  until focus completes
- **Hover tooltip** — hover any body to see its name and type
- **Body detail modal** — click "Details" on the HUD card to open a full modal
  with physical/orbital/rotation data, AI classification, similar-body
  navigation, and (for spacecraft) a Mission Info card showing agency, launch
  year, target, and status
- **AI classification** — precomputed ML classifications served via Express
  (planet/dwarf planet/asteroid/comet/spacecraft/etc.) with confidence scores,
  feature importance, and similar-body navigation, displayed in the HUD and detail modal
- **Scale toggle** — 4 modes: Visual (1×), Hybrid (0.6×), Real Planet Size (0.35×), Real Distance (0.25×)
- **4K textures** — planets and the Sun use 4K Solar System Scope textures; dwarf planets, asteroids, comets, and interstellar bodies use procedural Canvas noise textures as fallback
- **Saturn rings** — procedurally generated ring geometry on Saturn
- **HUD overlay** — current body name and a short fact, fades in on each
  transition
- **Orbit rings** — merged single-draw-call orbit guides for all planets

---

## Architecture

See `AGENTS.md` for the full agent-oriented reference. Key modules:

```
client/src/components/solar-system/
  SolarSystem.tsx        — Canvas, lights, planets, spacecraft, tour, HUD
  Planet.tsx             — GLB loader + orbital/spin logic, click-to-focus, hover, Saturn rings
  SpacecraftOrbit.tsx    — Positions spacecraft relative to parent body each frame
  CinematicTour.tsx      — Camera animation state machine (damp3)
  OrbitRings.tsx         — Merged LineSegments (1 draw call) for all 8 orbit paths
  InstancedStars.tsx     — Custom Points-based star field
  FocusCamera.tsx        — Camera lerp driven by zustand focus store
  LoadingSpinner.tsx     — Per-body loading progress grid
  BodyDetailModal.tsx    — Full-body detail modal with data explorer + mission info + similar bodies
  EnhancedDataExplorer.tsx  — Collapsible data panels (physical/orbital/rotation/AI)
  AIClassificationPanel.tsx — ML classification display
  DebugPanel.tsx         — GLB load status overlay
  bodies.ts              — Body config (name, radius, orbit, speed, tilt, fact, color, asset pointer,
                           parentBody, missionInfo)
```

### Body Types

| Type | Color | Description |
|------|-------|-------------|
| `star` | gold | The Sun |
| `planet` | blue | 8 solar system planets |
| `dwarfPlanet` | orange | Pluto, Ceres, Eris, etc. |
| `asteroid` | grey | Bennu, Eros, Psyche, etc. |
| `comet` | green | Halley's Comet |
| `interstellar` | purple | ʻOumuamua |
| `spacecraft` | teal | NASA missions (Curiosity, Cassini, Hubble, Voyager, Apollo LM) |

### Asset Pointers (`.glb.asset.json`)

Each `.glb.asset.json` file is a JSON object with a single `url` key:

```json
{ "url": "/models/curiosity.glb" }
```

Points to `public/models/`. To switch to an external CDN, update the `url` field.

### NASA Model Conversion Pipeline

```bash
npm run models:convert -- "/path/to/NASAmodel.obj" output-name
```

Pipeline: `obj2gltf` → Draco compression + 1024px texture resize → validation.

---

## Getting Started

```bash
npm install
npm run dev               # Vite dev server (:5000)
npm test                  # tsc + vitest (172 tests)
npm run build             # Production build → dist/
npm run build:cf          # CF Pages build (Draco → Vite)
npm run models:convert    # Convert a NASA OBJ model to GLB (see above)
npm run models:validate   # Validate GLBs against ML classifier
npm run ai:train          # Train spaceAI classifier (see spaceAI/README.md)
```

---

## Stack

- **React 18** + **TypeScript** + **Vite**
- **three** / **@react-three/fiber** / **@react-three/drei** / **postprocessing**
- **Tailwind CSS** (HUD) + **Zustand** (state)
- **Express** (AI classification cache) + **FastAPI** (dev AI training)
- **Python ML** (scikit-learn) — see `spaceAI/README.md`

---

## Tour Controls

| Action | Key / UI |
|--------|----------|
| Pause tour | Click "Pause tour · Free look" (top-right) |
| Resume tour | Click "Resume tour" (top-right) |
| Focus body | Click any body in the scene |
| Prev / next body | `←` / `→` |
| Open search | `/` or click "Search" button |
| Scale toggle | Click "REALISTIC" / "CINEMATIC" (top-right) |
| Free look (paused) | Click + drag to rotate, scroll to zoom |
| Close modal / clear focus | `Esc` |

The tour starts with a 10s solar-system establishing shot (wide orbit at distance 80, full 360° rotation), then cycles through all bodies (celestial + spacecraft). Each body gets 5 seconds: ~1.5s fly-in, ~3s arc around (216°), ~0.5s pull-back.

> **Note:** The Canvas uses `frameloop="demand"` — every `useFrame`/animation
> callback must call `state.invalidate()` or the scene freezes. `Planet`,
> `SpacecraftOrbit`, `CinematicTour`, and `FocusCamera` all do this.
>
> See [`AGENTS.md`](AGENTS.md) for AI API endpoints, database schema, CI/CD,
> GLB asset references, spacecraft details, and known issues.

---

## NASA Model Credits

Spacecraft models sourced from
[NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) — released by
NASA into the public domain. No copyright restrictions apply.
