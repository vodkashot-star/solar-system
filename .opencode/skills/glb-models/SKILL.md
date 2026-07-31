---
name: glb-models
description: Use when adding, converting, validating, or fixing GLB models, or when models fail to load in the app. Covers scripts/copy-draco.sh, convert_nasa_model.sh, validate_glb.sh, validate_models.py, and the .glb.asset.json pointer workflow.
---

# GLB Model Workflow

## Asset layout

- `client/public/models/<name>.glb` — binary model files (29 total, NASA public domain)
- `client/src/assets/solar/<name>.glb.asset.json` — pointer files, never hardcode `/models/` URLs
- `client/public/draco/` — Draco WASM decoders, copied by `scripts/copy-draco.sh` from `node_modules/three/examples/jsm/libs/draco/`

## Commands

| Command | Action |
|---------|--------|
| `npm run models:fetch` | Fetch NASA models |
| `npm run models:convert` | obj2gltf → Draco compress → texture resize |
| `npm run models:validate` | Validate GLB headers, asset JSONs, Draco, sizes |
| `npm run models:validate:fix` | Auto-fix (Draco compress) |
| `npm run models:check` | Python-side validation script |

## Adding a new model

1. `npm run models:convert` to produce a Draco-compressed GLB in `client/public/models/`
2. Create `client/src/assets/solar/<name>.glb.asset.json` with `{"url":"/models/<name>.glb"}`
3. Import the asset JSON in `client/src/components/solar-system/bodies.ts`
4. `npm run models:validate` to verify header, asset JSON, Draco, size
5. Run `npm run dev` (copy-draco runs automatically) and confirm the model loads

## Known pitfalls

- Draco WASM is copied automatically by `dev`/`build`/`build:cf` (first command in the npm scripts); if models fail to load anyway, run `bash scripts/copy-draco.sh` manually
- Corrupt GLBs (wrong JSON-chunk padding) are caught by `scripts/validate_glb.sh` — fix with `npm run models:validate:fix`
- **`cassini.glb`/`curiosity.glb`/`hubble.glb` use external textures** — loose files in `client/public/models/` (`baseColor_*.webp/png`, `cassini.glb_*.png`, `hubble.glb_*.png`, `normal_1.png`) referenced via GLB `uri`. They render white without them. `validate_glb.sh` warns ("external texture ref(s)") — the warning is expected for those 3 and must NOT be "fixed" by deleting the files
- No NASA model exists for `dragonfly` or the minor asteroids (`vesta`, `pallas`, `juno`, `hygiea`, `astraea`, `apophis`, `psyche`, `varda`, `oumuamua`, `halley`) — they use `FallbackSphere` (procedural textures), no `glbUrl`
