---
description: Add a new GLB model to the solar system ($1 = model name)
---

Add the model named `$1` to the app following the GLB workflow (see the glb-models skill):

1. `npm run models:convert` to produce a Draco-compressed GLB in `client/public/models/$1.glb`
2. Create `client/src/assets/solar/$1.glb.asset.json` with `{"url":"/models/$1.glb"}`
3. Import the asset JSON and register the body in `client/src/components/solar-system/bodies.ts`
4. `npm run models:validate` to verify header, asset JSON, Draco, size
5. If the body has no NASA model (e.g. `dragonfly`, minor asteroids), keep it on `FallbackSphere` (procedural textured sphere) — no `glbUrl`
