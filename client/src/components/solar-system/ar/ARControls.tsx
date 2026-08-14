import { useAR, type ARScaleMode } from "@/stores/ar";
import { xrStore, usePresenting } from "./ARCanvas";

function exitAR() {
  void xrStore.getState().session?.end();
}

/**
 * DOM overlay shown over the AR canvas — since the WebXR session owns the
 * frame loop and the XR component swaps in the AR camera, DOM controls live
 * outside the Canvas (they also work as a "composited overlay" on devices
 * without WebXR DOM overlay support).
 */
export function ARControls({ mode, bodyName }: {
  mode: "orrery" | "focus";
  bodyName?: string;
}) {
  const presenting = usePresenting();
  const { placed, scale, setScale, speed, setSpeed } = useAR();

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "1rem",
        color: "#fff",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <div
          style={{
            background: "rgba(8, 10, 22, 0.66)",
            backdropFilter: "blur(6px)",
            borderRadius: "0.6rem",
            padding: "0.45rem 0.8rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {mode === "orrery" ? "Orrery in Your Space" : `${bodyName ?? "Body"} in Your Space`}
        </div>
        <button
          onClick={exitAR}
          style={{
            pointerEvents: "auto",
            background: "rgba(196, 60, 60, 0.85)",
            color: "#fff",
            border: "none",
            borderRadius: "0.6rem",
            padding: "0.45rem 0.9rem",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Exit
        </button>
      </div>

      {mode === "orrery" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          {presenting && !placed && (
            <div
              style={{
                background: "rgba(8, 10, 22, 0.66)",
                backdropFilter: "blur(6px)",
                borderRadius: "999px",
                padding: "0.45rem 1.1rem",
                fontSize: "0.82rem",
                fontWeight: 600,
                opacity: 0.92,
              }}
            >
              Aim at the floor, then tap the reticle to place
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              background: "rgba(8, 10, 22, 0.66)",
              backdropFilter: "blur(6px)",
              borderRadius: "999px",
              padding: "0.45rem 1.1rem",
              pointerEvents: "auto",
            }}
          >
            <button
              onClick={() => setScale((scale === "table" ? "large" : "table") as ARScaleMode)}
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.35)",
                color: "#fff",
                borderRadius: "999px",
                padding: "0.2rem 0.7rem",
                fontSize: "0.78rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {scale === "table" ? "Tabletop" : "Large (2 m)"}
            </button>

            <button
              onClick={() => setSpeed(speed === 0 ? 1 : 0)}
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.35)",
                color: "#fff",
                borderRadius: "999px",
                padding: "0.2rem 0.7rem",
                fontSize: "0.78rem",
                cursor: "pointer",
                minWidth: "4.4rem",
              }}
            >
              {speed === 0 ? "▶ Play" : "⏸ Pause"}
            </button>

            <input
              type="range"
              min={0}
              max={3}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={{ width: "7rem", accentColor: "#C49A3C" }}
              aria-label="Orbit speed"
            />
          </div>
        </div>
      )}
    </div>
  );
}