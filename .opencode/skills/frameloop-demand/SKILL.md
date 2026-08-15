---
name: frameloop-demand
description: Use when writing or editing any React Three Fiber component, useFrame callback, animation, or Canvas code in client/src. The main tour Canvas runs with frameloop="demand" so every per-frame visual mutation must call state.invalidate() or the scene freezes. Also covers the pause-freeze contract, early-return traps, and the AR frameloop="always" exception.
---

# frameloop="demand" Rule

The main tour Canvas (`SolarSystem.tsx`) runs `<Canvas frameloop="demand">`.
R3F only renders a frame when `invalidate()` is called. Mutating THREE objects
via refs (`positions`, `rotation`, `material.opacity`, `uniforms`, `camera`,
`dashOffset`, …) is **invisible to React** — it does not trigger a re-render, so
nothing tells R3F to redraw. The ONLY way the canvas knows to draw your change
is `state.invalidate()`.

## Required pattern

```tsx
useFrame((state, delta) => {
  // ... mutate refs / THREE objects
  state.invalidate();
});
```

Destructure `invalidate` directly if you don't need the full state:

```tsx
useFrame(({ clock, invalidate }) => {
  ref.current.rotation.y = clock.elapsedTime;
  invalidate();
});
```

## Pause-freeze contract (critical)

Pausing must **truly freeze** the scene, not keep the demand loop alive at 0
speed. The speed slider is mirrored into `stores/simulation.ts` (`speed`, 0 =
paused) and the tour flag into `stores/cinematic-mode.ts` (`enabled`). Animated
components must gate BOTH the mutation AND the `invalidate()` on
`speed > 0 || cinematic`:

```tsx
useFrame(({ clock, invalidate }) => {
  if (ref.current) ref.current.scale.setScalar(70 * pulse);   // mutate
  if (speed > 0 || cinematic) invalidate();                    // schedule frame
});
```

References: `SunGlow.tsx`, `AtmosphereGlow.tsx`, `OrbitRings.tsx`,
`InstancedStars.tsx`, `OrbitalBody.tsx`, `Planet.tsx`. Do not invalidate
unconditionally in these — that defeats the freeze.

## Early-return trap

If your `useFrame` returns early (guarded by `if (!ref.current) return`,
`if (!enabled) return`, or a missing position), make sure the early path can't
**strand the demand loop**. If something still needs to render (e.g. a
focus/tour camera that must keep flying), call `invalidate()` BEFORE returning:

```tsx
const livePos = positions.current[targetBodyId];
if (!livePos) {
  invalidate();   // keep the loop alive while waiting for the body
  return;
}
```

Reference: `FocusCamera.tsx:81-88` (missing-position fallback must not strand
`isFocused`). A stuck camera leaves the tour frozen — the loop only runs when
something calls `invalidate()`.

## What does NOT need invalidate()

- **React state changes** (`setState`/`setLODLevel` inside the Canvas) — R3F
  re-renders on React commits, so no explicit `invalidate()` is needed
  (`lod-manager.ts` LOD threshold crosses).
- **DOM overlays** — components outside the Canvas (HUD, panels) don't touch
  the 3D scene.
- **Metrics probes** (`usePerformance.ts`) — publish to a store, no visuals.

## AR exception

AR pages (`#/ar/orrery`, `#/ar/<bodyId>`) use `ARCanvas.tsx` with
**`frameloop="always"`** — WebXR hooks R3F's loop and "demand" would freeze the
session. The demand rule applies ONLY to the main tour Canvas. Do not add
`invalidate()` calls to `ar/` components; they render continuously.

## Audit checklist (edit or add a useFrame)

1. Does it mutate a ref/THREE object per frame? → needs `invalidate()`.
2. Is it an animation that must freeze when paused? → gate mutation AND
   `invalidate()` on `speed > 0 || cinematic` (read via `useSimulation` /
   `useCinematicMode`).
3. Does it return early? → if the scene still needs frames, `invalidate()`
   before returning.
4. Is it inside `ar/` or `ModelPreview`? → `frameloop="always"`, skip.
5. If it only changes DOM/store state → no `invalidate()`.
6. Run `npm run typecheck` after any change.
