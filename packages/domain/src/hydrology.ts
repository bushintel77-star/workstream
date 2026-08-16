/**
 * Hydrological Pulse — irrigation/drainage flow calculations.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 Phase 2 (Hydrological Pulse)
 *
 * Implements the Hazen-Williams equation for pressure drop in landscape
 * irrigation and drainage runs. This is the standard calculation used by
 * irrigation designers for pipe sizing and zone flow analysis.
 *
 * Hydraulic Isolation (§5 mandate): the (0,0,0) origin peg is strictly
 * excluded from active hydraulic calculations — any run anchored at the
 * origin is a survey artifact, not a real hydraulic circuit.
 */

/** A single hydraulic run (irrigation line, drainage pipe, etc.). */
export interface HydraulicRun {
  id: string;
  /** Flow rate in litres per second (L/s). 1 L/s ≈ 15.85 US GPM. */
  flowLps: number;
  /** Internal pipe diameter in mm. */
  pipeDiameterMm: number;
  /** Run length in metres. */
  lengthM: number;
  /** Hazen-Williams roughness coefficient (PVC=150, copper=130, old steel=100). */
  cFactor: number;
}

/** Result of a hydraulic calculation for a single run. */
export interface HydraulicResult {
  runId: string;
  /** Pressure drop over the run in kPa. */
  pressureDropKpa: number;
  /** Flow in US gallons per minute (GPM). */
  gpm: number;
  /** Velocity in m/s. */
  velocityMs: number;
  /** Whether the run is valid (not origin-anchored). */
  valid: boolean;
  /** Reason if invalid. */
  invalidReason?: string;
}

/** Conversion: litres per second → US gallons per minute. */
const LPS_TO_GPM = 15.8503;

/**
 * Calculate hydraulic properties for a single run using Hazen-Williams.
 *
 * Formula (SI):
 *   ΔP (kPa) = 1.1101 × 10⁷ × (Q / C)^1.852 × L / D^4.87
 *
 * Where:
 *   Q = flow in L/s
 *   C = roughness coefficient
 *   L = length in m
 *   D = internal diameter in mm
 */
export function calculateHydraulicRun(run: HydraulicRun): HydraulicResult {
  const { id, flowLps, pipeDiameterMm, lengthM, cFactor } = run;

  if (flowLps <= 0 || pipeDiameterMm <= 0 || lengthM <= 0) {
    return {
      runId: id,
      pressureDropKpa: 0,
      gpm: 0,
      velocityMs: 0,
      valid: false,
      invalidReason: "Non-positive flow, diameter, or length",
    };
  }

  const gpm = flowLps * LPS_TO_GPM;

  // Hazen-Williams pressure drop (kPa)
  const qOverC = flowLps / cFactor;
  const pressureDropKpa =
    1.1101e7 * Math.pow(qOverC, 1.852) * (lengthM / Math.pow(pipeDiameterMm, 4.87));

  // Velocity: v = Q / A, where A = π × (D/2)² in m², Q in m³/s
  const diameterM = pipeDiameterMm / 1000;
  const areaM2 = Math.PI * Math.pow(diameterM / 2, 2);
  const flowM3s = flowLps / 1000;
  const velocityMs = areaM2 > 0 ? flowM3s / areaM2 : 0;

  return {
    runId: id,
    pressureDropKpa,
    gpm,
    velocityMs,
    valid: true,
  };
}

/**
 * Calculate hydraulic results for multiple runs.
 *
 * Hydraulic Isolation (§5): runs whose start point is at the (0,0) origin
 * are excluded — they are survey artifacts, not real circuits.
 */
export function calculateHydraulicRuns(
  runs: Array<HydraulicRun & { startIsOrigin?: boolean }>,
): HydraulicResult[] {
  return runs.map((run) => {
    if (run.startIsOrigin) {
      return {
        runId: run.id,
        pressureDropKpa: 0,
        gpm: 0,
        velocityMs: 0,
        valid: false,
        invalidReason: "Origin-anchored run excluded (hydraulic isolation §5)",
      };
    }
    return calculateHydraulicRun(run);
  });
}
