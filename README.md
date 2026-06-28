# Solar System · Cinematic 3D Tour

A full-screen 3D solar system with a cinematic camera tour through the Sun and 8 planets, rendered with high-quality GLB models. Built with React Three Fiber, Drei, and Three.js.

---

## Features

- **Cinematic tour** — camera automatically flies between bodies with smooth easing (7s per body, loops continuously)
- **9 GLB models** — sun + 8 planets, loaded via `useGLTF` and auto-normalized to correct scale
- **Bloom + Stars** — emissive sun glow via `@react-three/postprocessing`, custom instanced star field
- **Pause / Free Look** — toggle pauses the tour and enables OrbitControls for manual exploration
- **Click-to-focus** — click any planet to fly the camera to it; tour pauses until focus completes
- **Scale toggle** — switch between Cinematic (1×) and Realistic (0.25×) orbit/body scales
- **Saturn rings** — procedurally generated ring geometry on Saturn
- **HUD overlay** — current body name and a short fact, fades in on each transition
- **Orbit rings** — merged single-draw-call orbit guides for all 8 planets

---

## Architecture

```
client/src/
  components/
    solar-system/
      SolarSystem.tsx      — Canvas, lights, planets, tour, HUD
      Planet.tsx           — GLB loader + orbital/spin logic, click-to-focus, Saturn rings
      CinematicTour.tsx    — Camera animation state machine (damp3)
      OrbitRings.tsx       — Merged LineSegments (1 draw call) for all 8 orbit paths
      InstancedStars.tsx   — Custom Points-based star field
      FocusCamera.tsx      — Camera lerp driven by zustand focus store
      bodies.ts            — Body config (name, radius, orbit, speed, tilt, fact, color, asset pointer)
  stores/
    camera-focus.ts        — Zustand store for click-to-focus targets
  assets/
    solar/
      sun.glb.asset.json       — CDN pointer → "/models/sun.glb"
      mercury.glb.asset.json   — → "/models/mercury.glb"
      ... (9 total)
```

### Asset Pointers (`.glb.asset.json`)

Each `.glb.asset.json` file is a JSON object with a single `url` key:

```json
{"url": "/models/sun.glb"}
```

The path points to the public `/models/` directory where the actual `.glb` binary files live. In production, ensure all 9 GLB files are deployed under `public/models/`.

To switch to an external CDN (e.g. Lovable, Cloudflare R2, S3), update the `url` field in each `.asset.json` — no code changes needed.

### Available Models

| File | Size |
|---|---|
| `sun.glb` | 3.1 MB |
| `mercury.glb` | 20.6 MB |
| `venus.glb` | 9.2 MB |
| `earth.glb` | 22.7 MB |
| `mars.glb` | 13.3 MB |
| `jupiter.glb` | 3.7 MB |
| `saturn.glb` | 3.1 MB |
| `uranus.glb` | 87.2 MB |
| `neptune.glb` | 8.0 MB |

---

## Getting Started

```bash
npm install
npm run dev      # Vite dev server
npm run build    # Production build → dist/
npm run preview  # Serve built output
```

---

## Stack

- **React 19** + **TypeScript**
- **three** + **@react-three/fiber** + **@react-three/drei**
- **@react-three/postprocessing** (UnrealBloom)
- **maath** (damp3 easing)
- **Vite** (build tool)
- **Tailwind CSS** (HUD styling)

---

## Tour Controls

| Action | Key / UI |
|---|---|---|
| Pause tour | Click "Pause tour · Free look" (top-right) |
| Resume tour | Click "Resume tour" (top-right) |
| Focus planet | Click any planet body (click-to-focus, tour pauses) |
| Scale toggle | Click "REALISTIC" / "CINEMATIC" button (top-right) |
| Free look (paused) | Click + drag to rotate, scroll to zoom |

The tour state machine cycles: **Sun → Mercury → Venus → Earth → Mars → Jupiter → Saturn → Uranus → Neptune → loop**. Each body gets 7 seconds: ~2s fly-in, ~4s arc around, ~1s pull-back.
# solar-system
