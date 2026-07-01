---
description: frameloop="demand" requires explicit invalidate()
globs: client/src/**/*.tsx
---

# frameloop="demand" Rule

This project uses `<Canvas frameloop="demand">`. Any `useFrame` callback, animation, or state change that affects rendering **must** call `state.invalidate()`, or the canvas stays frozen.

Required pattern:
```tsx
useFrame((state, delta) => {
  // ... animation logic
  state.invalidate();
});
```
