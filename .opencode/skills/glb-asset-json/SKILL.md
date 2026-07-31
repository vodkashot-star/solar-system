---
name: glb-asset-json
description: Use when working with 3D model URLs, GLB assets, bodies.ts, or switching models to a CDN. All model URLs go through .glb.asset.json pointer files — never hardcode /models/ URLs.
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
