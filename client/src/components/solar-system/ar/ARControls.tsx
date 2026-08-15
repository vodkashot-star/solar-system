import { useAR, type ARScaleMode } from "@/stores/ar";
import { xrStore, usePresenting } from "./ARCanvas";
import { ENHANCED_ORRERY_CONFIG } from "./enhanced-orrery-data";

function exitAR() {
  void xrStore.getState().session?.end();
}

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const DAY_MS = 86400000;
/** ±30 years around J2000, covers every catalog mission launch year */
const TIME_RANGE_DAYS = 30 * 365.25;

export function formatARDate(days: number): string {
  const d = new Date(J2000_MS + days * DAY_MS);
  return d.toISOString().slice(0, 10);
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
  const {
    placed, scale, setScale, speed, setSpeed,
    showInfoPanels, setShowInfoPanels,
    currentTime, setCurrentTime, useAstronomicalPositions, setUseAstronomicalPositions,
  } = useAR();
  
  // Cycle through scale modes
  const cycleScale = () => {
    const scales: ARScaleMode[] = ["table", "large", "inner", "outer", "deep"];
    const currentIndex = scales.indexOf(scale);
    const nextIndex = (currentIndex + 1) % scales.length;
    setScale(scales[nextIndex]);
  };
  
  const scaleConfig = ENHANCED_ORRERY_CONFIG.scales[scale];

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
          {mode === "orrery" ? `${scaleConfig.name} Orrery` : `${bodyName ?? "Body"} in Your Space`}
          {mode === "orrery" && (
            <div style={{ fontSize: "0.7rem", opacity: 0.8, fontWeight: 400, marginTop: "0.2rem" }}>
              {scaleConfig.description}
            </div>
          )}
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

      {mode === "focus" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
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
              onClick={() => setShowInfoPanels(!showInfoPanels)}
              style={{
                background: showInfoPanels ? "rgba(196, 154, 60, 0.3)" : "none",
                border: "1px solid rgba(255,255,255,0.35)",
                color: "#fff",
                borderRadius: "999px",
                padding: "0.2rem 0.7rem",
                fontSize: "0.78rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {showInfoPanels ? "Hide Info" : "Show Info"}
            </button>
          </div>
        </div>
      )}

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
              onClick={cycleScale}
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.35)",
                color: "#fff",
                borderRadius: "999px",
                padding: "0.2rem 0.7rem",
                fontSize: "0.78rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
                minWidth: "5.5rem",
              }}
            >
              {scaleConfig.name}
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
            
            {mode === "orrery" && (
              <button
                onClick={() => setShowInfoPanels(!showInfoPanels)}
                style={{
                  background: showInfoPanels ? "rgba(196, 154, 60, 0.3)" : "none",
                  border: "1px solid rgba(255,255,255,0.35)",
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "0.2rem 0.7rem",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {showInfoPanels ? "Hide Info" : "Show Info"}
              </button>
            )}

            <button
              onClick={() => setUseAstronomicalPositions(!useAstronomicalPositions)}
              style={{
                background: useAstronomicalPositions ? "rgba(196, 154, 60, 0.3)" : "none",
                border: "1px solid rgba(255,255,255,0.35)",
                color: "#fff",
                borderRadius: "999px",
                padding: "0.2rem 0.7rem",
                fontSize: "0.78rem",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              aria-pressed={useAstronomicalPositions}
            >
              {useAstronomicalPositions ? "Real Positions" : "Simplified Orbits"}
            </button>
          </div>

          {useAstronomicalPositions && (
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
              <span style={{ fontSize: "0.75rem", whiteSpace: "nowrap", minWidth: "5.6rem" }}>
                {formatARDate(currentTime)}
              </span>
              <input
                type="range"
                min={-TIME_RANGE_DAYS}
                max={TIME_RANGE_DAYS}
                step={1}
                value={Math.max(-TIME_RANGE_DAYS, Math.min(TIME_RANGE_DAYS, currentTime))}
                onChange={(e) => setCurrentTime(Number(e.target.value))}
                style={{ width: "7rem", accentColor: "#C49A3C" }}
                aria-label="Simulation date"
              />
              <button
                onClick={() => setCurrentTime(0)}
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
                Now
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}