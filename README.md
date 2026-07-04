# Solar System · Cinematic 3D Tour

A full-screen 3D solar system with a cinematic camera tour through the Sun, 8
planets, and 20+ dwarf planets, asteroids, comets, interstellar objects, and
NASA spacecraft. Rendered with high-quality GLB models. Built with React Three
Fiber, Drei, and Three.js.

---

## Features

- **Cinematic tour** — camera automatically flies between bodies with smooth
  easing (5s per body, loops continuously)
- **34 GLB models** — sun + 8 planets + 20 dwarf planets/asteroids/comets +
  5 NASA spacecraft, loaded via `useGLTF` and auto-normalized to correct scale.
  Per-body loading grid shows individual progress; overlay dismisses when all
  models load or after a 15s timeout.
- **NASA spacecraft** — Curiosity Rover (Mars), Cassini (Saturn), Hubble Space
  Telescope (Earth), Voyager 1 (outer system), Apollo Lunar Module (Earth) as
  first-class bodies with their own orbits, data panels, and mission info cards.
  Models sourced from [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources)
  (public domain), converted from OBJ to Draco-compressed GLB via the
  `models:convert` pipeline.
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
- **AI classification** — precomputed ML classifications served via Cloudflare Pages Functions
  (planet/dwarf planet/asteroid/comet/spacecraft/etc.) with confidence scores,
  feature importance, and similar-body navigation, displayed in the HUD and detail modal
- **Scale toggle** — switch between Cinematic (1×) and Realistic (0.25×)
  orbit/body scales
- **4K textures** — planets and the Sun use 4K Solar System Scope textures embedded in GLBs; dwarf planets, asteroids, comets, and interstellar bodies use procedural Canvas noise textures as fallback
- **Saturn rings** — procedurally generated ring geometry on Saturn
- **HUD overlay** — current body name and a short fact, fades in on each
  transition
- **Orbit rings** — merged single-draw-call orbit guides for all planets

---

## Architecture

```
client/src/
  components/
    solar-system/
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
  stores/
    camera-focus.ts          — Zustand store for click-to-focus targets
  lib/
    load-debugger.ts         — Per-body load status tracking
    draco-setup.ts           — DRACOLoader wiring
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

Spacecraft have two extra fields on `Body`:
- `parentBody?: string` — ID of the body they orbit (e.g. `"mars"`)
- `missionInfo?: MissionInfo` — agency, launch year, target, status, description

### Asset Pointers (`.glb.asset.json`)

Each `.glb.asset.json` file is a JSON object with a single `url` key:

```json
{ "url": "/models/curiosity.glb" }
```

The path points to the public `/models/` directory. To switch to an external
CDN (e.g. Cloudflare R2, S3), update the `url` field — no code changes needed.

### NASA Model Conversion Pipeline

NASA 3D Resources ships OBJ + MTL + texture files. The `models:convert` script
converts them to Draco-compressed GLB in one step:

```bash
# Convert a single NASA OBJ model
npm run models:convert -- "/path/to/NASAmodel.obj" output-name

# Example — Curiosity Rover
npm run models:convert -- "NASA-3D-Resources/3D Models/Curiosity Rover (MSL)/curiosity.obj" curiosity
# → client/public/models/curiosity.glb
```

Pipeline internals:
1. `obj2gltf` — OBJ + MTL + textures → raw GLB
2. `@gltf-transform optimize` — Draco compression + texture resize to 1024px
3. `gltf-transform validate` — sanity check on the output

### Available Models

| File | Type | Size |
|------|------|------|
| `sun.glb` | star | 2.1 MB |
| `mercury.glb` … `neptune.glb` | planet | 0.3–8.9 MB |
| `pluto.glb` … `gonggong.glb` | dwarf planet | 0.2–0.4 MB |
| `bennu.glb` … `psyche.glb` | asteroid | 0.1–0.3 MB |
| `halley.glb` | comet | 0.1 MB |
| `oumuamua.glb` | interstellar | 0.1 MB |
| `curiosity.glb` | spacecraft | ~1–3 MB |
| `cassini.glb` | spacecraft | ~1–3 MB |
| `hubble.glb` | spacecraft | ~1–3 MB |
| `voyager.glb` | spacecraft | ~0.5 MB |
| `apollo-lm.glb` | spacecraft | ~1 MB |

All GLB files use Draco compression.

---

## Getting Started

```bash
npm install
npm run dev               # Vite dev server (:5000)
npm run build             # Production build → dist/
npm run build:cf          # CF Pages build (regenerates AI cache → Draco → Vite)
npm test                  # Run tests (vitest)
npm run models:convert    # Convert a NASA OBJ model to GLB (see above)
npm run models:validate   # Validate GLBs against ML classification
npm run ai:train          # Train spaceAI RandomForest classifier (11 features)
npm run ai:serve          # Start local AI classification microservice for dev
```

---

## Stack

- **React 18** + **TypeScript**
- **three** + **@react-three/fiber** + **@react-three/drei**
- **@react-three/postprocessing** (UnrealBloom)
- **maath** (damp3 easing)
- **Vite** (build tool)
- **Tailwind CSS** (HUD styling)
- **Zustand** (state management)
- **Cloudflare Pages Functions** (AI classification via precomputed cache)
- **FastAPI** (dev) — local AI training microservice (Python)
- **obj2gltf** (dev) — OBJ → GLB conversion for NASA models
- **@gltf-transform/cli** (dev) — Draco compression + optimisation

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

The tour cycles through all bodies (celestial + spacecraft). Each body gets 5
seconds: ~1.5s fly-in, ~3s arc around (216°), ~0.5s pull-back.

> **Note:** The Canvas uses `frameloop="demand"` — every `useFrame`/animation
> callback must call `state.invalidate()` or the scene freezes. `Planet`,
> `SpacecraftOrbit`, `CinematicTour`, and `FocusCamera` all do this.

---

## NASA Model Credits

Spacecraft models sourced from
[NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) — released by
NASA into the public domain. No copyright restrictions apply.
