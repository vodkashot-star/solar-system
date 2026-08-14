import { useEffect, useState } from "react";
import { BODIES } from "../bodies";
import { ARCanvas, xrStore, usePresenting } from "./ARCanvas";
import { ARScene } from "./ARScene";
import { ARControls } from "./ARControls";
import { isIOS, supportsWebXR, loadModelViewer, usdzUrlOf } from "./usdz";

declare global {
  // model-viewer (Google) custom element — no published React types
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        "ios-src"?: string;
        ar?: boolean;
        "ar-modes"?: string;
        "camera-controls"?: boolean;
        "auto-rotate"?: boolean;
        "rotation-per-second"?: string;
        "shadow-intensity"?: string;
        "environment-image"?: string;
      };
    }
  }
}

function StartOverlay({ label, sub }: { label: string; sub: string }) {
  const presenting = usePresenting();
  if (presenting) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        background: "rgba(2, 3, 10, 0.45)",
        backdropFilter: "blur(2px)",
        color: "#fff",
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        zIndex: 10,
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <div style={{ fontSize: "1.35rem", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "0.9rem", opacity: 0.75, maxWidth: "420px" }}>{sub}</div>
      <button
        onClick={() => {
          void xrStore.enterAR();
        }}
        style={{
          background: "#C49A3C",
          color: "#02030a",
          border: "none",
          borderRadius: "999px",
          padding: "0.8rem 2.2rem",
          fontSize: "1rem",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Enter AR
      </button>
      <div style={{ fontSize: "0.75rem", opacity: 0.5 }}>Requires an AR-capable Android phone or a WebXR desktop browser</div>
    </div>
  );
}

function ModelViewer({ glbUrl, usdzUrl, title }: { glbUrl: string; usdzUrl?: string; title: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadModelViewer().catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          gap: "0.5rem",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
          Could not load the 3D viewer — tap the AR icon on supported devices after reloading.
        </div>
      </div>
    );
  }

  return (
    // model-viewer is a custom element (typed via JSX.IntrinsicElements above)
    <model-viewer
      src={glbUrl}
      ios-src={usdzUrl}
      ar
      ar-modes="webxr scene-viewer quick-look"
      camera-controls
      auto-rotate
      rotation-per-second="12deg"
      shadow-intensity="1"
      environment-image="neutral"
      style={{ width: "100%", height: "100%", backgroundColor: "#02030a" }}
    >
      <div
        slot="ar-button"
        style={{
          background: "#C49A3C",
          color: "#02030a",
          borderRadius: "999px",
          padding: "0.7rem 1.6rem",
          fontSize: "0.95rem",
          fontWeight: 700,
          position: "absolute",
          bottom: "1.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          whiteSpace: "nowrap",
        }}
      >
        View in AR
      </div>
    </model-viewer>
  );
}

/**
 * AR page — `#/ar/orrery` shows the miniature solar system, `#/ar/<bodyId>`
 * focuses a single body (GLB + its moons). iOS and non-WebXR browsers fall
 * back to <model-viewer> with AR Quick Look (USDZ).
 */
export function ARPage({ mode, bodyId }: { mode: "orrery" | "focus"; bodyId?: string }) {
  const body = bodyId ? BODIES.find((b) => b.id === bodyId) : undefined;
  const [webxr, setWebxr] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    supportsWebXR().then((ok) => alive && setWebxr(ok));
    return () => {
      alive = false;
    };
  }, []);

  const ios = isIOS();
  const useModelViewer = mode === "focus" && body?.glbUrl && (ios || webxr === false);

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100dvh",
        background: "#02030a",
        overflow: "hidden",
      }}
    >
      {useModelViewer && body?.glbUrl ? (
        <ModelViewer glbUrl={body.glbUrl} usdzUrl={usdzUrlOf(body.glbUrl)} title={body.name} />
      ) : (
        <>
          <ARCanvas>
            <ARScene mode={mode} bodyId={bodyId} />
          </ARCanvas>
          <ARControls mode={mode} bodyName={body?.name} />
          {mode === "orrery" && ios && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: "2rem",
                pointerEvents: "none",
                zIndex: 10,
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
                fontSize: "0.82rem",
                color: "#fff",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  background: "rgba(8, 10, 22, 0.66)",
                  backdropFilter: "blur(6px)",
                  borderRadius: "999px",
                  padding: "0.45rem 1.1rem",
                }}
              >
                iOS: use the Focus mode (body page) for AR Quick Look — WebXR orrery needs Android/desktop
              </div>
            </div>
          )}
          {mode === "orrery" && !ios && (
            <StartOverlay
              label="Orrery in Your Space"
              sub="Place a miniature solar system on any flat surface — 8 planets, 9 moons, orbital motion."
            />
          )}
          {mode === "focus" &&
            (ios && !body?.glbUrl ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "2rem",
                  color: "#fff",
                  fontFamily: "ui-sans-serif, system-ui, sans-serif",
                  fontSize: "0.9rem",
                  textAlign: "center",
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    background: "rgba(8, 10, 22, 0.66)",
                    backdropFilter: "blur(6px)",
                    borderRadius: "0.6rem",
                    padding: "0.8rem 1.2rem",
                    maxWidth: "420px",
                  }}
                >
                  No AR model for {body?.name} on iOS — try a body with a 3D model, or the Orrery on Android/desktop.
                </div>
              </div>
            ) : (
              <StartOverlay
                label={`${body?.name ?? "Body"} in Your Space`}
                sub="Anchor the body to a surface, then walk around it. Its moons follow Keplerian orbits."
              />
            ))}
        </>
      )}
    </div>
  );
}

export default ARPage;