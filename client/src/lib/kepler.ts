/**
 * Kepler equation solvers used for computing orbital positions.
 *
 * Both Planet.tsx and OrbitRings.tsx previously duplicated these — they now
 * share this single implementation.
 */

/** Iterative Newton-Raphson solver for the elliptic Kepler equation (e < 1). */
export function solveKeplerElliptic(M: number, e: number): number {
  let E = M;
  for (let i = 0; i < 12; i++) {
    const dE = (M - E + e * Math.sin(E)) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-8) break;
  }
  return E;
}

/** Iterative solver for the hyperbolic Kepler equation (e > 1). */
export function solveKeplerHyperbolic(M: number, e: number): number {
  let H = M;
  for (let i = 0; i < 20; i++) {
    const dH = (M - e * Math.sinh(H) + H) / (e * Math.cosh(H) - 1);
    H += dH;
    if (Math.abs(dH) < 1e-8) break;
  }
  return H;
}

/**
 * Unified Kepler solver that dispatches to the correct variant based on
 * eccentricity:
 *  - e ≈ 0  → circular, return M directly
 *  - e < 1  → elliptic
 *  - e > 1  → hyperbolic
 */
export function solveKepler(M: number, e: number): number {
  if (e < 1e-6) return M;
  if (e > 1) return solveKeplerHyperbolic(M, e);
  return solveKeplerElliptic(M, e);
}
