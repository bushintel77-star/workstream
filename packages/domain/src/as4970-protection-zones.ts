/**
 * AS 4970-2025 tree protection zones (indicative Workflow 1).
 *
 * NRZ (notional root zone) — historically TPZ in AS 4970-2009.
 * SRZ (structural root zone) — mechanical stability.
 *
 * Domain-pure: no DOM / server imports.
 */

export type As4970EncroachmentTier =
  | "none"
  | "minor"
  | "moderate"
  | "major";

export type As4970ProtectionZones = {
  /** Combined / single DBH used for NRZ (metres). */
  dbh_m: number;
  /** Notional root zone radius (m), clamped 2–15. */
  nrz_radius_m: number;
  /** Structural root zone radius (m), min 1.5. */
  srz_radius_m: number;
};

const NRZ_MIN_M = 2;
const NRZ_MAX_M = 15;
const SRZ_MIN_M = 1.5;

/** Combined multi-stem DBH (m): √(Σ Di²). */
export function combinedDbhM(stemDbhM: number[]): number {
  const stems = stemDbhM.filter((d) => Number.isFinite(d) && d > 0);
  if (stems.length === 0) return 0;
  if (stems.length === 1) return stems[0]!;
  const sumSq = stems.reduce((acc, d) => acc + d * d, 0);
  return Math.sqrt(sumSq);
}

/**
 * NRZ radius (m): DBH(m) × 12, clamped to [2, 15].
 * Alias of legacy TPZ for Workflow 1 boards.
 */
export function nrzRadiusFromDbhM(dbhM: number): number {
  if (!Number.isFinite(dbhM) || dbhM <= 0) return 0;
  const raw = dbhM * 12;
  return Math.min(NRZ_MAX_M, Math.max(NRZ_MIN_M, raw));
}

/**
 * SRZ radius (m): (D × 50)^0.42 × 0.64 where D is trunk diameter (m)
 * measured just above the root buttress. Minimum 1.5 m.
 */
export function srzRadiusFromTrunkM(trunkDiameterM: number): number {
  if (!Number.isFinite(trunkDiameterM) || trunkDiameterM <= 0) return 0;
  const raw = Math.pow(trunkDiameterM * 50, 0.42) * 0.64;
  return Math.max(SRZ_MIN_M, raw);
}

/** Convenience: NRZ + SRZ from one DBH (SRZ uses same D when buttress unknown). */
export function computeAs4970ProtectionZones(
  dbhM: number | number[],
): As4970ProtectionZones {
  const combined = Array.isArray(dbhM) ? combinedDbhM(dbhM) : dbhM;
  return {
    dbh_m: combined,
    nrz_radius_m: nrzRadiusFromDbhM(combined),
    srz_radius_m: srzRadiusFromTrunkM(combined),
  };
}

/**
 * Encroachment tier vs NRZ area % and SRZ intrusion.
 * - none: < 0.05% of NRZ area
 * - minor: ≤ 10% NRZ, entirely outside SRZ
 * - moderate: 11–20% NRZ, entirely outside SRZ
 * - major: > 20% NRZ OR any SRZ intrusion
 */
export function classifyAs4970Encroachment(args: {
  nrzAreaEncroachPct: number;
  intrudesSrz: boolean;
}): As4970EncroachmentTier {
  if (args.intrudesSrz) return "major";
  const pct = args.nrzAreaEncroachPct;
  if (!Number.isFinite(pct) || pct < 0) return "none";
  if (pct < 0.05) return "none";
  if (pct <= 10) return "minor";
  if (pct <= 20) return "moderate";
  return "major";
}

/** Legacy bridge: DBH in cm → NRZ radius (m), matching prior TPZ helper. */
export function nrzRadiusFromDbhCm(dbhCm: number): number {
  if (!Number.isFinite(dbhCm) || dbhCm <= 0) return 0;
  return nrzRadiusFromDbhM(dbhCm / 100);
}
