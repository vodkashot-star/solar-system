# Adding a Celestial Body

Step-by-step guide for adding a new body to the scene.

---

## 1. Generate or source a GLB model

Place the `.glb` file in `client/public/models/<id>.glb`. All models should use Draco compression to keep file size small (target < 5 MB).

To generate procedurally via Blender:

```bash
# Edit scripts/generate_celestial_models.py — add your body
bash scripts/run_blender_generation.sh
# Output lands in client/public/models/
```

Use `add_detail=False` to avoid vertex explosion (the Uranus lesson — 83 MB without it).

---

## 2. Create the asset pointer file

```bash
echo '{"url": "/models/<id>.glb"}' > client/src/assets/solar/<id>.glb.asset.json
```

Example for a body named `sedna`:

```json
{"url": "/models/sedna.glb"}
```

---

## 3. Add the import in `bodies.ts`

```ts
// client/src/components/solar-system/bodies.ts
import sednaGlb from "@/assets/solar/sedna.glb.asset.json";
```

---

## 4. Add astronomical data

Add an entry to `ASTRONOMICAL_DATA` in `bodies.ts`:

```ts
sedna: {
  mass: 0.0005,           // Earth masses
  radius: 0.155,          // Earth radii
  density: 2.0,           // g/cm³
  gravity: 0.4,           // m/s²
  temperature: 12,        // Kelvin
  orbitalPeriod: 4000000, // Earth days
  semiMajorAxis: 506,     // AU
  eccentricity: 0.843,
  inclination: 11.93,     // degrees
  rotationPeriod: 10,     // Earth hours
  axialTilt: 0,           // degrees
},
```

---

## 5. Add the body entry in `BODIES`

```ts
{
  id: "sedna",
  type: "dwarfPlanet",          // star | planet | dwarfPlanet | asteroid | comet | interstellar
  name: "Sedna",
  visualRadius: 0.3,            // scene units — controls display size
  orbit: 90,                    // scene units from sun (use AU × ~1 for outer bodies)
  orbitSpeed: 0.001,            // radians/second — slower for distant bodies
  spinSpeed: 0.1,               // radians/second on own axis
  tilt: 0,                      // axial tilt in radians
  phase: 2.5,                   // initial orbital angle in radians
  color: "#cc8866",             // fallback color before GLB loads
  glbUrl: sednaGlb.url,
  fact: "One of the most distant known objects in the solar system.",
  properties: ASTRONOMICAL_DATA.sedna,
},
```

**Orbit speed formula** (reference from existing bodies):
`orbitSpeed ≈ 0.26 * (12.5 / orbit)` — Earth's speed at orbit 12.5 as the reference.

---

## 6. Verify

```bash
npm run check   # must pass with no TS errors
npm run dev     # visually confirm the body appears in scene
```

Check:
- Fallback colored sphere appears immediately at the correct orbit
- GLB swaps in after load
- Body appears in the cinematic tour
- Click-to-focus works
- Orbit ring appears with the correct category color

---

## Orbit Ring Colors

The orbit ring color is determined automatically from the body's `type`:

| type | color |
|------|-------|
| `star` | gold `#ffd700` |
| `planet` | blue `#4fc3f7` |
| `dwarfPlanet` | amber `#ffb74d` |
| `asteroid` | grey `#9e9e9e` |
| `comet` | green `#66bb6a` |
| `interstellar` | purple `#ce93d8` |

No changes to `OrbitRings.tsx` needed — it reads `body.type` from the `BODIES` array.

---

## Saturn-style Rings

If the body has visible rings, set `hasRings: true` in its `BODIES` entry:

```ts
{ id: "sedna", ..., hasRings: true }
```

`Planet.tsx` renders ring geometry for any body with `hasRings: true`.

---

## Notes

- Bodies with `orbit: 0` (like Oumuamua) don't get an orbit ring and are placed at the origin
- `phase` staggers the starting angle so bodies don't all line up at the same spot
- `visualRadius` affects the fallback sphere size and the camera framing fallback; the actual framing uses the GLB bounding box once loaded
- `spinSpeed` can be negative for retrograde rotation (e.g., Venus, Uranus)
