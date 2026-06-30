---
date: 2026-06-23T14:00:00Z
git_commit: cdfb692
branch: master
repository: local
topic: "P2 Research: SpaceAI Integration, Educational Overlays, and Discovery Recommendations"
tags: [research, codebase, spaceAI, ui-patterns, recommendations, architecture]
last_updated: 2026-06-23T14:00:00Z
---

## Ticket Synopsis

Research the codebase to understand the current state of three P2 features on the roadmap (`thoughts/plans/roadmap-v1.md`):

1. **SpaceAI integration** — What exists in the `spaceAI/` Python ML sub-project, what data is available, and how it could connect to the app.
2. **Educational overlays** — What UI patterns exist for HUD/overlay components, and what educational content hooks are present.
3. **Discovery recommendations** — What a recommendation system could look like given existing data structures and architecture.

## Summary

The codebase has **significant pre-built infrastructure** for all three P2 features — more than the roadmap suggests. The `AIAnalysis` type and `AstronomicalProperties` are fully defined in `bodies.ts`, and two client-side UI components (`AIClassificationPanel`, `EnhancedDataExplorer`) already render AI analysis data. The `spaceAI/` Python sub-project has a working `RandomForestClassifier` pipeline with training scripts, a Jupyter notebook, and a `CelestialPredictor` class. What's missing: (1) no server-side API endpoints bridge the Python model to the React frontend, (2) no trained model `.pkl` files are committed, (3) the AI components aren't wired into `SolarSystem.tsx`'s HUD, and (4) the `ScaleControl.tsx` exists alongside a simpler scale toggle in `SolarSystem.tsx` — suggesting two competing implementations.

For educational overlays, the app has a consistent dark-space HUD aesthetic using Tailwind with `backdrop-blur-md`, `border-white/10`, and `bg-black/60` patterns. Six discrete overlay sections exist (context-loss recovery, top bar, bottom info card, loading spinner, debug panel, scale control), but no modals, tooltips, toasts, or drawer components exist. Educational content is limited to one-line `fact` strings per body and the `ScaleControl`'s descriptions.

For discovery recommendations, the `AIAnalysis.alternatives` and `AIAnalysis.similarObjects` arrays define a ready-made recommendation data structure. The `AstronomicalProperties` on each body (14 real-astronomy fields) provide rich feature vectors for similarity computation. No recommendation algorithm or UI exists yet.

## Detailed Findings

### 1. SpaceAI Integration

#### 1.1 Python ML Sub-project (`spaceAI/`)

**17 files** across 5 directories:

- **Source scripts** (`spaceAI/src/`):
  - `train_model.py:92` — Main training script: creates/loads `celestial_objects.csv`, trains a `RandomForestClassifier` on `orbital_period`, `axial_tilt`, `mass` features, evaluates accuracy, saves model, runs test predictions. Key differences from `setup_and_train.py`: uses `max_depth=5`, has more sample data (10 rows vs 6), prints richer evaluation.
  - `setup_and_train.py:50` — Simplified version: creates dataset, trains RandomForest, saves to `celestial_classifier_dt.pkl`.
  - `predict.py:78` — `CelestialPredictor` class: loads a `.pkl` model, provides `predict(orbital_period, axial_tilt, mass)` and `predict_batch(data_list)` methods. Has both `__main__` example usage and class-based API.

- **Data** (`spaceAI/data/`):
  - `celestial_objects.csv:7` — 6 rows, 4 columns: `orbital_period, axial_tilt, mass, type`. Labels: Planet, Moon, Asteroid, Dwarf Planet. Extremely small dataset (not viable for production).

- **Model storage** (`spaceAI/models/`):
  - **Empty** — no `.pkl` or `.h5` files committed.

- **Notebook** (`spaceAI/notebooks/`):
  - `train_celestial_classifier.ipynb:121` — Jupyter notebook with markdown + code cells for loading data, training DecisionTree, evaluating accuracy, saving model. All cells show `execution_count: null` — never been run.

- **Documentation** (`spaceAI/docs/`):
  - `integration.md:85` — Describes integration pattern: Game → Python API → Trained Models. References `classify.py`, `predict.py`, `recommend.py` scripts (only `predict.py` exists). Shows JSON response format `{ prediction, confidence, timestamp }`.
  - `architecture.md:72` — 4-layer diagram: Game → Python API Layer → Trained Models → Data Layer. Describes REST endpoints via Flask/FastAPI (not implemented), CLI scripts, Python importable modules.
  - `data-format.md:54` — Schema for stars.csv, planets.csv, galaxies.csv (none of these files exist in `spaceAI/data/`). Only `celestial_objects.csv` exists.
  - `celestial-features.md:56` — Educational reference for stellar/planetary/galaxy parameters with ranges and significance.
  - `model-training.md:88` — ML training guide: classification vs regression, model types, cross-validation, hyperparameter tuning.
  - `getting-started.md:68` — Poetry setup instructions, basic training workflow.
  - `troubleshooting.md:83` — Common issues and solutions.

#### 1.2 Client-Side AI Infrastructure

- `bodies.ts:17-23` — **`AIAnalysis` type** fully defined:
  ```ts
  type AIAnalysis = {
    classification: string;
    confidence: number;
    alternatives: Array<{ type: string; score: number }>;
    features: Array<{ name: string; value: number; importance: number }>;
    similarObjects: Array<{ bodyId: string; similarity: number }>;
  };
  ```

- `bodies.ts:49` — **`aiAnalysis?: AIAnalysis`** is an optional field on every `Body` object. Currently undefined for all 9 bodies.

- `bodies.ts:64-182` — **`ASTRONOMICAL_DATA`** record with complete real NASA data for Sun + 8 planets: `mass`, `radius`, `density`, `gravity`, `temperature`, `orbitalPeriod`, `semiMajorAxis`, `eccentricity`, `inclination`, `rotationPeriod`, `axialTilt`.

- `AIClassificationPanel.tsx:83` — Fully implemented component that renders AI analysis results: classification label with confidence bar, alternative classifications with mini confidence bars, key features list. Gracefully handles missing data with "Waiting for prediction..." fallback. Uses consistent HUD styling: `rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md`.

- `EnhancedDataExplorer.tsx:145` — Tabbed/collapsible data explorer with 4 sections: Physical Properties, Orbital Properties, Rotation Properties, AI Analysis. Embeds `AIClassificationPanel` inside a `CollapsibleSection` with default `isOpen=false`.

#### 1.3 Server-Side API

- `server/routes.ts:10` — Only one route: `GET /api/health`. **No AI/classification/prediction endpoints exist.**
- `server/app.ts:91` — Express app with CORS, JSON middleware, request logging, error handler. Ready to add routes.

#### 1.4 Integration Gap Summary

| Component | Status | Gap |
|-----------|--------|-----|
| Python ML model | Trained RandomForest exists in code | No `.pkl` committed; tiny 6-row dataset |
| Server API endpoint | Not implemented | No bridge between Python model and Express |
| Client AI types | Fully defined in `bodies.ts` | No data flowing (all `aiAnalysis` are undefined) |
| Client AI UI | `AIClassificationPanel` + `EnhancedDataExplorer` built | Not imported/referenced in `SolarSystem.tsx` |
| API config | `API_BASE` in `config.ts` | No endpoints to call |
| HTTP client | `queryClient.ts` with `apiRequest` | Not wired to anything |

### 2. Educational Overlays

#### 2.1 Existing HUD Architecture

`SolarSystem.tsx` renders **6 distinct overlay sections** outside the Canvas:

| Section | Position | z-index | Pattern |
|---------|----------|---------|---------|
| Context-loss recovery | `fixed inset-0` | `z-50` | Fullscreen blocker, `bg-black/90 backdrop-blur-sm` |
| Loading spinner | `fixed inset-0` | `z-50` | Fullscreen overlay, `bg-black/70 backdrop-blur-sm` |
| DebugPanel | `fixed bottom-4 right-4` | `z-40` | Fixed corner panel, `bg-black/70 backdrop-blur-md` |
| Top bar (title + buttons) | `absolute inset-x-0 top-0 p-4` | normal flow | Flex row, `pointer-events-none` wrapper |
| Bottom info card | `absolute bottom-6 left-4 right-4` | normal flow | `rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md` |
| ScaleControl (if active) | `absolute bottom-6 left-4 right-4` | normal flow | Same positioning as info card (separate view?) |

#### 2.2 Styling System

All overlay components use a **consistent dark-space design language**:
- Background: `bg-black/60` to `bg-black/90` with `backdrop-blur-md`/`backdrop-blur-sm`
- Borders: `border border-white/10` or `border-white/15`
- Text: `text-white/40` (labels), `text-white/60` (body), `text-white/80` (headings)
- Z-index: `z-40` (panels) → `z-50` (fullscreen overlays)
- Decorative: `.astrolabe-ring` (gold triple-nested circles), `.corner-marker` (gold corner brackets)
- Responsive: `sm:` breakpoint adjustments for padding and max-width

#### 2.3 Educational Content Hooks

- `bodies.ts:38-39` — **`fact: string`** on every Body: one-liner educational fact (e.g., "A failed star. More massive than all other planets combined.").
- `SolarSystem.tsx:143` — Renders `active.fact` in the bottom info card via `<p>{active.fact}</p>`.
- `ScaleControl.tsx:64-70` — Has educational descriptions per scale mode + a note about real scales being impractical.
- `EnhancedDataExplorer.tsx` — Educational data display of real astronomical properties with formatted units.
- `index.css:118-186` — `.astrolabe-ring` and `.corner-marker` decorative CSS suggesting an astrolabe/navigational theme for educational UI.

#### 2.4 Missing Overlay Types

No modals, tooltips, popovers, toasts, notifications, or drawer components exist anywhere in the codebase. All overlays are hand-rolled Tailwind divs. The `AIClassificationPanel` and `EnhancedDataExplorer` are built but **never imported** in `SolarSystem.tsx`.

### 3. Discovery Recommendations

#### 3.1 Existing Recommendation Data Structures

The `AIAnalysis` type (`bodies.ts:17-23`) already defines:

```ts
alternatives: Array<{ type: string; score: number }>;
  // Alternative classifications with confidence scores
features: Array<{ name: string; value: number; importance: number }>;
  // Feature contributions to the classification
similarObjects: Array<{ bodyId: string; similarity: number }>;
  // Similar bodies with similarity scores
```

This is a ready-made **recommendation data model**: `similarObjects` directly maps to "you might also like" recommendations, `alternatives` maps to "other possible classifications" discovery.

#### 3.2 Feature Vectors for Similarity

Each body has 14 `AstronomicalProperties` fields (`bodies.ts:64-182`):

| Category | Fields |
|----------|--------|
| Physical | `mass`, `radius`, `density`, `gravity`, `temperature` |
| Orbital | `orbitalPeriod`, `semiMajorAxis`, `eccentricity`, `inclination` |
| Rotational | `rotationPeriod`, `axialTilt` |

These could drive similarity computations:
- **Cosine similarity** on normalized feature vectors (mass, radius, orbital period, etc.)
- **Category-based grouping** (terrestrial vs gas giants vs ice giants)
- **Property ranges** (e.g., "similar temperature bodies", "similar orbital period")

#### 3.3 Integration Points for Recommendations

- **Click-to-focus**: `Planet.tsx:109-116` → `handleClick` calls `focus(body.id, position)`. After focusing, `EnhancedDataExplorer` or a new recommendations panel could show similar bodies.
- **Tour stop**: `CinematicTour.tsx:33-36` — `onActiveChange` fires when tour advances. Could trigger recommendation display alongside the active body fact.
- **Zustand store pattern**: The `camera-focus.ts:19` store pattern could be extended or replicated for a `recommendations` store.

#### 3.4 SpaceAI Model as Recommendation Engine

The existing RandomForest classifier could power recommendations:
- **Feature extraction**: Use `predict.py`'s `CelestialPredictor.predict(orbital_period, axial_tilt, mass)` to classify bodies
- **Decision path analysis**: RandomForest's `feature_importances_` maps to `features[].importance` in the type
- **Leaf-node similarity**: Bodies that follow the same decision path in the tree are structurally similar — maps to `similarObjects[]`
- **Probability distribution**: `predict_proba()` provides class probabilities → maps to `alternatives[]`

## Data Flow Diagram (Proposed Integration)

```
spaceAI/                          server/                         client/
──────────                        ──────                        ──────
Python scripts                    Express API                     React components
  │                                  │                              │
  ├─ train_model.py                  │                              │
  │   └─ DecisionTreeClassifier      │                              │
  │       └─ .pkl (serialized) ──────►  GET /api/classify/:id       │
  │                                  │    └─ load .pkl             │
  ├─ predict.py                      │    └─ predict(features)     │
  │   └─ CelestialPredictor          │    └─ return AIAnalysis ────►  SolarSystem.tsx
  │                                  │                              │  └─ Planet click
  └─ celestial_objects.csv           │                              │      └─ fetch /api/classify
       (training data)               │                              │           ↓
                                    │                              │  EnhancedDataExplorer
                                                                     │  └─ AIClassificationPanel
                                                                     │       └─ render aiAnalysis
```

## Code References

- `spaceAI/src/train_model.py:37` — RandomForestClassifier training pipeline
- `spaceAI/src/predict.py:14` — CelestialPredictor class with predict/predict_batch methods
- `spaceAI/docs/integration.md:85` — Integration architecture diagram and API response format
- `client/src/components/solar-system/bodies.ts:17-23` — AIAnalysis type definition
- `client/src/components/solar-system/bodies.ts:64-182` — ASTRONOMICAL_DATA record (full NASA data)
- `client/src/components/solar-system/AIClassificationPanel.tsx:83` — AI results UI component
- `client/src/components/solar-system/EnhancedDataExplorer.tsx:145` — Collapsible data explorer
- `client/src/components/solar-system/SolarSystem.tsx:104-148` — Six HUD overlay sections
- `client/src/index.css:118-186` — Astrolabe decorative classes
- `server/routes.ts:4` — Only /api/health endpoint exists
- `client/src/lib/config.ts:16` — API_BASE configuration
- `thoughts/plans/roadmap-v1.md:16` — P2 feature listing in roadmap

## Architecture Insights

1. **Layered integration**: The entire SpaceAI integration follows a clear 3-tier pattern: Python ML backend (`spaceAI/`) → Express API bridge (`server/`) → React frontend (`client/`). Each tier has infrastructure but the middle bridge is missing.

2. **Type-system readiness**: The `AIAnalysis` type in `bodies.ts` is remarkably well-designed for this stage — it includes `alternatives` (for discovery) and `similarObjects` (for recommendations) even though no backend yet produces them. The types were designed with P2 features in mind.

3. **Hand-rolled UI components**: The app avoids UI libraries entirely — all overlays, panels, and cards are hand-crafted with Tailwind. The visual language is consistent: `border-white/10`, `bg-black/60`–`bg-white/[0.04]`, `backdrop-blur-md`, monospace labels, uppercase tracking.

4. **Competing scale implementations**: `SolarSystem.tsx:119` has a simple cinematic/realistic toggle button, while `ScaleControl.tsx:77` implements a 4-mode system (visual, realSize, realDistance, hybrid) with full descriptions. The `ScaleControl` is never imported — appears to be a newer design not yet adopted.

5. **Data-layer gap**: The spaceAI/docs reference `stars.csv`, `planets.csv`, `galaxies.csv` that don't exist. Only `celestial_objects.csv` (6 rows) exists. The docs describe a larger data ecosystem than what's implemented.

## Historical Context (from thoughts/)

- `thoughts/plans/roadmap-v1.md:16-18` — Lists all three P2 items as unchecked future work. "SpaceAI integration" and "Educational overlays" are separate items (but tightly coupled in practice).
- `thoughts/architecture/rendering-pipeline.md:379-403` — Data flow diagram showing current state: bodies.ts → Planet.tsx → Three.js scene. No AI data path exists yet.
- `thoughts/reviews/performance-audit.md:10` — Notes 163 MB GLB payload, Uranus OOM risk, missing Draco — all P0 items now fixed. No mention of P2 features.
- `thoughts/tickets/ticket-001-black-screen.md:200` — Black-screen ticket (status: implemented). Focused on rendering, no P2 content.
- `thoughts/plans/p0-black-screen-fixes.md:618` — Detailed implementation plan for P0 fixes. Deviations section documents implementation decisions.

## Related Research

- No prior research documents exist in `thoughts/research/` (directory was empty).

## Open Questions

1. **Server-side ML execution**: Should the Express server execute Python scripts via `child_process` (simple, but blocking), spawn a separate Python microservice with Flask/FastAPI, or convert the DecisionTree to a portable format (e.g., ONNX, or implement in TypeScript directly)?
2. **ScaleControl adoption**: Does `ScaleControl.tsx` replace the current simple toggle, or coexist? The 4-mode system needs to be reconciled with SolarSystem's existing `setScaleMode("cinematic"|"realistic")`.
3. **Training data**: The 6-row `celestial_objects.csv` is insufficient. Should the real `ASTRONOMICAL_DATA` from `bodies.ts` serve as the training dataset (9 labeled rows → still tiny), or is the intent purely educational (demonstrating ML, not production-grade)?
4. **Recommendation algorithm**: Should similarity be computed server-side (Python `sklearn.metrics.pairwise`) or client-side (simple JS cosine similarity on `AstronomicalProperties`)? Client-side avoids backend dependency but replicates logic.
5. **UI placement**: Should `AIClassificationPanel` appear as a tour-stop overlay (replacing the bottom info card), a side panel during focus, or a toggleable section in `EnhancedDataExplorer`?
6. **Orphaned components**: `AIClassificationPanel.tsx`, `EnhancedDataExplorer.tsx`, and `ScaleControl.tsx` exist but are never imported. Were they part of a previous iteration or prepared for P2 implementation?
