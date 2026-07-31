---
name: frameloop-demand
description: Use when writing or editing any React Three Fiber component, useFrame callback, animation, or Canvas code in client/src. The Canvas runs with frameloop="demand" so every frame mutation must call state.invalidate() or the scene freezes.
---

# frameloop="demand" Rule

This project uses `<Canvas frameloop="demand">`. Any `useFrame` callback,
animation, or state change that affects rendering **must** call
`state.invalidate()`, or the canvas stays frozen.

Required pattern:

```tsx
useFrame((state, delta) => {
  // ... animation logic
  state.invalidate();
});
```
