// FieldLoop v0.1 — compliance-engine/vba-triggers.ts
// Pure Victorian statutory compliance triggers. No I/O — unit-testable in Vitest.

export type WorkClass =
  | 'gasfitting'
  | 'sanitary'
  | 'roofing'
  | 'drainage'
  | 'mechanical'
  | 'refrigeration';

/** GST math. AU GST is 10%. */
export const GST_RATE = 0.1;

export function applyGst(subtotal: number): { subtotal: number; gst: number; total: number } {
  const gst = Math.round(subtotal * GST_RATE * 100) / 100;
  const total = Math.round((subtotal + gst) * 100) / 100;
  return { subtotal, gst, total };
}

/** Statutory thresholds (cents-safe via dollars; keep in AUD). */
export const COES_VALUE_THRESHOLD = 750; // inc. GST
export const DBI_VALUE_THRESHOLD = 16_000;
export const MDC_VALUE_THRESHOLD = 10_000;
export const MDC_DEPOSIT_HIGH_WATERMARK = 20_000;
export const DEPOSIT_CAP_OVER_20K = 0.05;
export const DEPOSIT_CAP_UNDER_20K = 0.1;
export const COES_LODGE_WINDOW_DAYS = 5;

/** Work classes that force a COES regardless of value. */
const COES_FORCED_WORK_CLASSES: ReadonlySet<WorkClass> = new Set([
  'gasfitting',
  'drainage', // below-ground sanitary drainage
]);

export interface ComplianceJob {
  totalIncGst: number;
  workClass: WorkClass[];
  isDomestic: boolean; // domestic building/renovation vs commercial
  hasCoolingTower: boolean;
}

export interface ComplianceAssessment {
  coesRequired: boolean;
  coesReasons: string[];
  coesLodgeByDays: number;
  dbiRequired: boolean;
  mdcRequired: boolean;
  depositCapRate: number | null;
  coolingOffDisclosureRequired: boolean;
}

/** Evaluate all statutory triggers for a job. */
export function assessCompliance(job: ComplianceJob): ComplianceAssessment {
  const coesReasons: string[] = [];
  if (job.totalIncGst > COES_VALUE_THRESHOLD) {
    coesReasons.push(`value $${job.totalIncGst.toFixed(2)} exceeds $${COES_VALUE_THRESHOLD} inc. GST`);
  }
  for (const wc of job.workClass) {
    if (COES_FORCED_WORK_CLASSES.has(wc)) {
      coesReasons.push(`work class ${wc} requires COES`);
    }
  }
  if (job.hasCoolingTower) {
    coesReasons.push('cooling tower work requires COES');
  }

  const coesRequired = coesReasons.length > 0;
  const dbiRequired = job.isDomestic && job.totalIncGst > DBI_VALUE_THRESHOLD;
  const mdcRequired = job.isDomestic && job.totalIncGst > MDC_VALUE_THRESHOLD;

  let depositCapRate: number | null = null;
  if (mdcRequired) {
    depositCapRate =
      job.totalIncGst > MDC_DEPOSIT_HIGH_WATERMARK
        ? DEPOSIT_CAP_OVER_20K
        : DEPOSIT_CAP_UNDER_20K;
  }

  return {
    coesRequired,
    coesReasons,
    coesLodgeByDays: COES_LODGE_WINDOW_DAYS,
    dbiRequired,
    mdcRequired,
    depositCapRate,
    coolingOffDisclosureRequired: mdcRequired,
  };
}

/** Maximum allowable deposit for a consumer contract. */
export function maxDeposit(totalIncGst: number, isDomestic: boolean): number {
  const assessment = assessCompliance({
    totalIncGst,
    workClass: [],
    isDomestic,
    hasCoolingTower: false,
  });
  if (!assessment.depositCapRate) return 0;
  return Math.round(totalIncGst * assessment.depositCapRate * 100) / 100;
}
