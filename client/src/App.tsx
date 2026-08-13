import { lazy, Suspense, useEffect, useMemo } from "react";
import * as Sentry from "@sentry/react";
import { initDracoDecoder } from "./lib/draco-setup";
import { initSentry } from "./lib/sentry";
import { reportWebVitals } from "./lib/web-vitals";
import ModelPreview from "./components/ModelPreview";

// Initialize Sentry before any other code
initSentry();

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
    reportWebVitals();
  }, []);

  const previewModelId = useMemo(getPreviewModelId, []);

  if (previewModelId) {
    return <ModelPreview id={previewModelId} />;
  }

  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div
          style={{
            width: "100vw",
            height: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#02030a",
            color: "#ffffff",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ opacity: 0.7, marginBottom: "2rem", maxWidth: "500px" }}>
            {(error as Error)?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={resetError}
            style={{
              background: "#C49A3C",
              color: "#02030a",
              border: "none",
              padding: "0.75rem 2rem",
              borderRadius: "0.5rem",
              fontSize: "1rem",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Reload Scene
          </button>
        </div>
      )}
    >
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
    </Sentry.ErrorBoundary>
  );
}

export default App;