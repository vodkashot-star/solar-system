import { lazy, Suspense, useEffect, useMemo } from "react";
import { initDracoDecoder } from "./lib/draco-setup";
import ModelPreview from "./components/ModelPreview";

const SolarSystem = lazy(() => import("@/components/solar-system/SolarSystem"));

/**
 * Model-preview routing — `?model=<bodyId>` (or `#/model/<bodyId>` hash) opens
 * the GLB studio instead of the tour so each NASA asset can be inspected at
 * full resolution.
 */
function getPreviewModelId(): string | null {
  const query = new URLSearchParams(window.location.search).get("model");
  if (query) return query;
  const hash = window.location.hash;
  if (hash.startsWith("#/model/")) {
    try {
      return decodeURIComponent(hash.slice("#/model/".length));
    } catch {
      return hash.slice("#/model/".length);
    }
  }
  return null;
}

function App() {
  useEffect(() => {
    initDracoDecoder();
  }, []);

  const previewModelId = useMemo(getPreviewModelId, []);

  if (previewModelId) {
    return <ModelPreview id={previewModelId} />;
  }

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