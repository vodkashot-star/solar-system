# Solar System — Roadmap v1

**Updated:** 2026-06-28

## Prioritization

### P0 — Critical (rendering/crashing bugs)
- [x] Fix black-screen root causes (Uranus GLB 83 MB → 277 KB, preload removed)
- [x] Deploy Draco decoder pipeline
- [x] Add `invalidate()` to Planet `useFrame`
- [x] Audit and fix camera framing (computedRadii from GLB bounding box)
- [x] Reduce Uranus asset size (Draco-compressed, `add_detail=False`)
- [x] Fix LoadingSpinner — 15s timeout prevents infinite blocking

### P1 — High (user-facing quality)
- [x] Context-loss recovery overlay
- [x] Wire 29 bodies (Sun + 8 planets + 20 dwarf planets/asteroids/comets/interstellar)
- [x] Orbit ring color-coding by body category
- [x] SpaceAI FastAPI integration (classify endpoint, Express proxy, HUD panel)
- [ ] Mobile performance: downscale Earth/Mercury/Mars textures (21 MB, 19 MB, 13 MB each)
- [ ] Better loading UI (progress per-body, not global spinner)

### P2 — Future (features & content)
- [x] SpaceAI ML classification pipeline (RandomForest, FastAPI microservice)
- [ ] Educational overlays (tooltips, body detail modal)
- [ ] Discovery recommendations (similarObjects panel — data exists, UI not wired)
- [ ] LOD system (full / half / decimated mesh levels by camera distance)
- [ ] Bloom optimization (disable when scene is static / tour paused)
