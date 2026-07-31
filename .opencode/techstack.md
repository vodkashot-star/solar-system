---
language: typescript
runtime: node
framework:
  frontend: react
  backend: express
  ml: fastapi
css: tailwind
database: postgres
orm: drizzle
build:
  frontend: vite
  backend: esbuild
ml_framework: scikit-learn
---

# Tech Stack

## Frontend

- **React 18** with TypeScript
- **React Three Fiber** (`@react-three/fiber`) — Three.js React renderer
- **@react-three/drei** — R3F utility components
- **Three.js** — 3D engine (GLB model rendering)
- **Zustand** — state management
- **Tailwind CSS** — styling
- **Vite** — build tool / dev server
- **GLSL** — custom shaders (via `vite-plugin-glsl`)

## Backend

- **Express** — HTTP server
- **Drizzle ORM** — PostgreSQL migrations/queries
- **tsx** — TypeScript execution for dev server

## ML Sub-project (spaceAI/)

- **Python 3.11+** — FastAPI microservice
- **scikit-learn** — RandomForest classification
- **pandas / numpy** — data processing
- **joblib** — model serialization
- **uvicorn** — ASGI server
- **Poetry** — dependency management

## Infrastructure

- **PostgreSQL** — primary database
- **Docker** — containerized deployment (app + spaceAI)
- **GitHub Actions** — CI/CD
