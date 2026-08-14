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
  // Seed from the asymptotic solution H ≈ ln(2|M|/e). For M > 0, sinh
  // H ≈ e^H/2, so e·sinh(H) ≈ (e/2)e^H ≈ M ⇒ H ≈ ln(2M/e) (the +1 guards
  // M → 0). The sign must follow M, because hyperbolic bodies on the inbound
  // leg (e.g. Oumuamua at phase ≈ -1.6, e ≈ 1.2) have M < 0 and need H < 0.
  // Seeding from H₀ = M (the elliptic default) diverges once M ≳ 25 for e≈3.8
  // (Voyager 1), and the unsigned ln(2M/e+1) produces ln(<0) = NaN for M < 0.
  let H = Math.sign(M) * Math.log((2 * Math.abs(M)) / e + 1);
  for (let i = 0; i < 30; i++) {
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
