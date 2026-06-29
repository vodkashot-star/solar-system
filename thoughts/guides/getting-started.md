# Getting Started — CosmicVoyage

A practical guide for setting up and running the project locally.

---

## Prerequisites

- Node.js 18+
- `node_modules/` is committed — no install needed unless dependencies change
- Python 3.10+ (only required for the SpaceAI FastAPI service)
- Blender 3.4+ (only required for regenerating GLB models)

---

## Running the App

### Dev mode (frontend only)

```bash
npm run dev
```

Opens Vite dev server with HMR at `http://localhost:5000`. The app works fully without the SpaceAI service — the AI classification panel simply won't appear in the HUD.

### Dev mode (full stack — frontend + SpaceAI)

```bash
bash scripts/dev.sh
```

Starts Express (`:5000`) + FastAPI (`:8000`) together. FastAPI auto-restarts on crash. Ctrl+C kills both.

> Before first run, train the SpaceAI model:
> ```bash
> cd spaceAI && pip install -r requirements.txt && python run.py train
> ```

### Production build

```bash
npm run build   # copies Draco decoder, runs Vite build, bundles server
npm start       # serves dist/ on port 5000
```

### TypeScript check

```bash
npm run check   # tsc — the only verification step (no linter, no tests)
```

---

## Project Layout

```
client/src/
  components/solar-system/   — all 3D scene components
  stores/camera-focus.ts     — zustand store for click-to-focus
  assets/solar/              — GLB asset pointer JSON files (29 total)
  lib/draco-setup.ts         — wires DRACOLoader into useGLTF

server/
  app.ts                     — Express setup + logging
  routes.ts                  — /api/health + /api/ai/classify proxy
  index-prod.ts              — production entry point

spaceAI/
  run.py                     — unified CLI (train, test, query, classify, recommend, serve)
  api.py                     — FastAPI microservice (GET /classify/:bodyId)
  src/
    train_model.py           — trains RandomForest, saves .pkl
    predict.py               — CelestialPredictor class used by api.py

client/public/
  models/                    — 29 Draco-compressed .glb files
  draco/                     — decoder WASM + JS (copied by copy-draco.sh)
```

---

## How the Scene Works

When the page loads:

1. React mounts `SolarSystem.tsx` — the Canvas is created with `frameloop="demand"` (renders only when `invalidate()` is called)
2. 29 `<Planet>` components mount, each inside a `<Suspense>` — colored fallback spheres appear immediately
3. GLBs load progressively in the background; each swaps from fallback sphere to 3D model as it arrives
4. `LoadingSpinner` hides when all 29 models load, or after 15 seconds
5. `CinematicTour` flies the camera through bodies automatically (Sun → planets → loop)

**Click any body** to pause the tour and focus on it. Click "Resume tour" to return to the automated tour.

**Pause tour** enables free OrbitControls — drag to orbit, scroll to zoom.

**Scale toggle** switches between cinematic (1×) and realistic (0.25×) scale for orbits and body sizes.

---

## Key Patterns

**`frameloop="demand"`** — The canvas only renders when something calls `state.invalidate()`. Every animation path (Planet `useFrame`, CinematicTour, FocusCamera, OrbitControls) calls it. If you add new animation, you must call `invalidate()`.

**Asset pointers** — GLB URLs live in `client/src/assets/solar/*.glb.asset.json`, not hardcoded. To point at a CDN, change the JSON files only.

**computedRadii** — After each GLB loads, `Planet.tsx` computes the actual bounding box and reports it via `onComputedRadius`. Camera controllers use this for correct framing (includes Saturn's rings).

---

## Draco Decoder

All 29 GLB files use Draco compression. The decoder files must be in `client/public/draco/`. They're copied automatically by `npm run build`. For dev, they're already present. If they go missing:

```bash
bash scripts/copy-draco.sh
```

---

## SpaceAI Service

The FastAPI service is optional. When running, it classifies each body using a RandomForest trained on real astronomical data (orbital period, axial tilt, mass, radius, eccentricity). Results appear in the HUD info card.

When offline, `routes.ts` returns `503` and `SolarSystem.tsx` catches it silently — no error shown.
