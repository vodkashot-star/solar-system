import { Canvas } from "@react-three/fiber";
import { Component, Suspense, useState, useEffect } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { Analytics } from "@vercel/analytics/react";
import "@fontsource/inter";
import { SolarSystem } from "./components/SolarSystem";
import { PlanetCard } from "./components/PlanetCard";
import { SoundManager } from "./components/SoundManager";
import { GameOnboarding } from "./components/GameOnboarding";
import { AudioManager } from "./components/AudioManager";
import { Toaster } from "./components/ui/sonner";
import { CollapsibleGameMenu } from "./components/CollapsibleGameMenu";
import { initDracoDecoder } from "./lib/draco-setup";
import { ModelDiagnostics } from "@/components/ModelDiagnostics";
import { APIHealthCheck } from "@/components/APIHealthCheck";

class CanvasErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[CanvasErrorBoundary] 3D canvas failed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function AppInner() {
  useEffect(() => {
    initDracoDecoder();
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        position: "relative",
        overflow: "hidden",
        background: "#070814",
      }}
    >
      <div className="corner-marker corner-marker-tl" aria-hidden="true" />
      <div className="corner-marker corner-marker-tr" aria-hidden="true" />
      <div className="corner-marker corner-marker-bl" aria-hidden="true" />
      <div className="corner-marker corner-marker-br" aria-hidden="true" />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only fixed top-4 left-4 z-[9999] bg-brass p-2 text-void rounded-md"
      >
        Skip to Main Content
      </a>

      <main id="main-content" tabIndex={-1} style={{ width: "100%", height: "100%" }}>
        <CanvasErrorBoundary
          fallback={
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#070814",
                color: "#C49A3C",
                fontSize: "1.2rem",
              }}
            >
              Loading celestial chart...
            </div>
          }
        >
          <Canvas
            style={{ width: "100%", height: "100%", display: "block" }}
            camera={{
              position: [0, 30, 60],
              fov: 60,
              near: 0.1,
              far: 1000,
            }}
            gl={{
              antialias: true,
              powerPreference: "high-performance",
              alpha: false,
            }}
          >
            <Suspense fallback={null}>
              <SolarSystem />
            </Suspense>
          </Canvas>
        </CanvasErrorBoundary>
      </main>
      <CollapsibleGameMenu position="right" />
      <PlanetCard />

      <div className="astrolabe-ring" style={{ width: 'min(80vw, 80vh)', height: 'min(80vw, 80vh)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} aria-hidden="true" />

      <GameOnboarding />
      <AudioManager />
      <SoundManager />
      <ModelDiagnostics />
      <APIHealthCheck />
      <Toaster />
      <Analytics />
    </div>
  );
}

function App() {
  return <AppInner />;
}

export default App;
