# Performance Baseline — Solar System

Captured 2026-06-22 from `dist/` production build. All sizes in kilobytes (KB) / megabytes (MB) unless noted. Network estimates assume 30 Mbps connection (3.75 MB/s throughput).

## Metrics

| Metric | Before | After Ph1 | After Ph2a | After Ph2b | After Ph3 |
|--------|--------|-----------|------------|------------|-----------|
| **Uranus GLB size** | 84 MB | **~10–15 MB** | ~10–15 MB | ~10–15 MB | ~10–15 MB |
| **Total GLB size** | 163 MB | **~89–94 MB** | ~89–94 MB | ~89–94 MB | ~89–94 MB |
| **First render** | ~45 s | ~45 s¹ | **~1–2 s**² | ~1–2 s | ~1–2 s |
| **Total load** | ~45 s | ~25 s | ~25 s³ | ~25 s | ~25 s |
| **JS bundle (raw)** | 1,118 KB | 1,118 KB | 1,118 KB | ~1,120 KB | ~1,120 KB |
| **JS bundle (gzip)** | 309 KB | 309 KB | 309 KB | ~311 KB | ~311 KB |

## Bundle Breakdown

| Chunk | Raw | Gzip | Contents |
|-------|-----|------|----------|
| `vendor_shared-CXeAavnc.js` | 832 KB | 215 KB | three.js, @react-three/fiber, @react-three/drei, @react-three/postprocessing, zustand, maath |
| `vendor_react-CGgagVQh.js` | 269 KB | 87 KB | react, react-dom, scheduler |
| `SolarSystem-DGMVWpvU.js` | 15 KB | 6 KB | Our components (Planet, CinematicTour, FocusCamera, etc.) |
| `index-lDxZEvxM.js` | 1.9 KB | 1 KB | App shell, Draco init |

## GLB Size Detail

| Body | Current | After Ph1 | Method |
|------|---------|-----------|--------|
| uranus | **84 MB** | **~10–15 MB** | Decimate + Draco (90–94% reduction) |
| earth | 22 MB | 22 MB | Unchanged |
| mercury | 20 MB | 20 MB | Unchanged |
| mars | 13 MB | 13 MB | Unchanged |
| venus | 8.9 MB | 8.9 MB | Unchanged |
| neptune | 7.7 MB | 7.7 MB | Unchanged |
| jupiter | 3.6 MB | 3.6 MB | Unchanged |
| saturn | 3.0 MB | 3.0 MB | Unchanged |
| sun | 2.1 MB | 2.1 MB | Unchanged |
| **Total** | **163 MB** | **~89–94 MB** | |

## Notes

1. **After Ph1 first render unchanged** — `useGLTF.preload` at `Planet.tsx:16-18` still blocks module evaluation. All 9 GLBs (now ~94 MB total) download before first paint. No improvement until Ph2a removes the preload.

2. **After Ph2a first render drops to ~1–2 s** — Fallback spheres render on mount (~200 ms) + GLBs load progressively per-planet via Suspense. First meaningful paint occurs when the first Suspense boundary resolves (inner planets load first — Sun, Mercury are 2.1 MB + 20 MB).

3. **After Ph2a total load stays ~25 s** — Total download volume unchanged from Ph1 (~94 MB). The difference is loading is non-blocking: user sees fallback spheres + HUD immediately while streaming.

4. **JS bundle projections** are estimates. The context-loss overlay (Ph2b) adds a few KB of React elements and event handlers. The camera framing computation (Ph3) adds negligible code.

5. **Draco WASM decoder** (~280 KB) is loaded at runtime by `draco_decoder.wasm` — not included in JS bundle sizes above. It's fetched separately from `/draco/draco_decoder.wasm` on first `useGLTF` call that encounters a compressed GLB.
