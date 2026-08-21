// FieldLoop v0.1 — compliance-engine/gas-test.ts
// Pure validators for the field test screens (gas soundness, backflow, TMV).
// No I/O — unit-testable in Vitest.

export interface GasSoundnessTest {
  staticPressureKpa: number;
  workingPressureKpa: number;
  testDurationMinutes: number;
  pressureDropKpa: number;
}

export interface GasSoundnessResult {
  pass: boolean;
  failures: string[];
}

/** AS/NZS 5601: static + working pressure recorded, 5-minute zero-drop. */
export function validateGasSoundness(test: GasSoundnessTest): GasSoundnessResult {
  const failures: string[] = [];
  if (test.staticPressureKpa <= 0) failures.push('static pressure must be recorded (> 0 kPa)');
  if (test.workingPressureKpa <= 0) failures.push('working pressure must be recorded (> 0 kPa)');
  if (test.testDurationMinutes < 5) failures.push('test duration must be at least 5 minutes');
  if (test.pressureDropKpa !== 0) failures.push('pressure drop must be 0.0 kPa over the test');
  return { pass: failures.length === 0, failures };
}

export interface BackflowTest {
  linePressureKpa: number;
  reliefValveOpeningPressureKpa: number;
}

export interface BackflowResult {
  pass: boolean;
  failures: string[];
}

/** Relief valve opening pressure must exceed 14 kPa. */
export function validateBackflow(test: BackflowTest): BackflowResult {
  const failures: string[] = [];
  if (test.linePressureKpa <= 0) failures.push('line pressure must be recorded (> 0 kPa)');
  if (test.reliefValveOpeningPressureKpa <= 14) {
    failures.push('relief valve opening pressure must exceed 14 kPa');
  }
  return { pass: failures.length === 0, failures };
}

export interface TvmTest {
  hotSupplyC: number;
  mixedOutletC: number;
}

export interface TvmResult {
  pass: boolean;
  failures: string[];
}

/**
 * TMV mixed outlet band. The AS 4032.3 acceptable range depends on the device
 * application; 35–46 °C is the common washbasin band and is used as the default.
 * Confirm the exact band against the device spec at build time.
 */
export const TMV_MIXED_MIN_C = 35;
export const TMV_MIXED_MAX_C = 46;

export function validateTmv(test: TvmTest): TvmResult {
  const failures: string[] = [];
  if (test.mixedOutletC < TMV_MIXED_MIN_C || test.mixedOutletC > TMV_MIXED_MAX_C) {
    failures.push(
      `mixed outlet ${test.mixedOutletC} °C outside ${TMV_MIXED_MIN_C}–${TMV_MIXED_MAX_C} °C band`,
    );
  }
  return { pass: failures.length === 0, failures };
}
