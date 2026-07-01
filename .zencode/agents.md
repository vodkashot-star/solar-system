# Parallel Agents Guide

For complex multi-domain tasks, spawn specialized sub-agents in parallel:

## Frontend Agent
Use for: React/Three.js rendering, shaders, UI components, GLB assets, animation.
Focus: `client/src/` — bodies.ts, Planet.tsx, SolarSystem.tsx, CinematicTour.tsx, stores/, lib/

## Backend Agent
Use for: Express routes, Drizzle schema, server config, proxy logic, production deployment.
Focus: `server/` — routes.ts, app.ts, index-dev.ts, index-prod.ts, shared/schema.ts

## ML Agent
Use for: Python model training, FastAPI endpoints, feature engineering, data pipelines.
Focus: `spaceAI/` — api.py, run.py, src/train_model.py, src/predict.py

## Spawning Pattern

For tasks requiring multiple domains, use the `task` tool to run them in parallel:
```
# Example: "add a new celestial body with ML classification"
task frontend-agent: update bodies.ts, create GLB asset
task backend-agent:    add DB migration, update API route
task ml-agent:         retrain model, update taxonomy
```
