/** iOS Safari / iPadOS have no WebXR — route those devices to AR Quick Look via model-viewer. */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function supportsWebXR(): Promise<boolean> {
  const xr = (navigator as unknown as { xr?: { isSessionSupported(mode: string): Promise<boolean> } }).xr;
  if (!xr?.isSessionSupported) return Promise.resolve(false);
  return xr.isSessionSupported("immersive-ar").catch(() => false);
}

let modelViewerPromise: Promise<void> | null = null;

/** Lazily injects <model-viewer> (Google) once; resolves when the element is registered. */
export function loadModelViewer(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.customElements.get("model-viewer")) return Promise.resolve();
  if (!modelViewerPromise) {
    modelViewerPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        modelViewerPromise = null;
        reject(new Error("Failed to load model-viewer"));
      };
      document.head.appendChild(s);
    });
  }
  return modelViewerPromise;
}

/** AR Quick Look URL — USDZ lives next to the GLB in models-usdz/. */
export function usdzUrlOf(glbUrl?: string): string | undefined {
  return glbUrl?.replace(/\.glb$/, ".usdz");
}