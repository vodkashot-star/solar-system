---
description: GLB asset pointers use .glb.asset.json indirection
globs: client/src/**/*.ts
---

# GLB Asset Pointer Rule

All 3D model URLs are defined in `*.glb.asset.json` files under
`client/src/assets/solar/`. Each is imported in `bodies.ts`. Never hardcode
`/models/` URLs. To swap to a CDN, edit only the JSON files.

```ts
// bodies.ts — correct pattern
import bennuAsset from "../assets/solar/bennu.glb.asset.json";
// uses bennuAsset.url
```
