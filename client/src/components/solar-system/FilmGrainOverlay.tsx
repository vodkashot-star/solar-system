/**
 * FilmGrainOverlay.tsx
 *
 * Zero-cost cinematic grade: a CSS film-grain noise tile (animated via
 * steps() so it shimmers like real grain) + a soft radial vignette.
 * Pure DOM — sits above the WebGL canvas, below all UI, costs no GPU time.
 */

export default function FilmGrainOverlay() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.42) 88%, rgba(0,0,0,0.62) 100%)",
        }}
      />
      <div className="film-grain absolute -inset-16" />
    </div>
  );
}