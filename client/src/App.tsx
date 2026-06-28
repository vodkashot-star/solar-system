import { lazy, Suspense, useEffect } from "react";
import { initDracoDecoder } from "./lib/draco-setup";

const SolarSystem = lazy(() => import("@/components/solar-system/SolarSystem"));

function App() {
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
        background: "#02030a",
      }}
    >
      <Suspense
        fallback={
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#02030a",
              color: "#ffffff",
              fontSize: "0.9rem",
              opacity: 0.5,
            }}
          >
            Loading scene…
          </div>
        }
      >
        <SolarSystem />
      </Suspense>
    </div>
  );
}

export default App;
