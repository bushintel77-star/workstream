import type { Store } from "@workstream/db";
import type {
  ProjectStatus,
  StageFinding,
  StageGuard,
  StageLog,
} from "@workstream/contracts";

export type { StageFinding, StageGuard, StageLog } from "@workstream/contracts";

export type StageResult<T> =
  | { ok: true; value: T; log: StageLog }
  | { ok: false; log: StageLog };

type StageWork<T> = (ctx: {
  store: Store;
  ownerId: string;
  projectId: string;
}) => Promise<T>;

type AuditHook<T> = (result: T) => StageFinding[];
type GuardHook<T> = (result: T) => StageGuard[];

function now() {
  return new Date().toISOString();
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Run a single stage with built-in self-audit and guard rails.
 * Retries transient work up to `maxAttempts` times with exponential backoff.
 * If any guard fails, the stage fails fast and returns a failed StageLog.
 */
export async function runStage<T>(opts: {
  stage: string;
  store: Store;
  ownerId: string;
  projectId: string;
  work: StageWork<T>;
  audit: AuditHook<T>;
  guard: GuardHook<T>;
  maxAttempts?: number;
  baseDelayMs?: number;
  onStatus?: (status: ProjectStatus) => Promise<void>;
  onLog?: (log: StageLog) => Promise<void>;
  skip?: boolean;
}): Promise<StageResult<T>> {
  if (opts.skip) {
    const log: StageLog = {
      stage: opts.stage,
      startedAt: now(),
      completedAt: now(),
      attempts: 0,
      passed: true,
      findings: [],
      guard: [],
      status: "skipped",
      error: null,
    };
    await opts.onLog?.(log);
    if (!opts.onLog) await opts.store.appendStageLog(opts.ownerId, opts.projectId, log, opts.stage);
    return { ok: true, value: undefined as T, log };
  }

  const maxAttempts = opts.maxAttempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  const startedAt = now();
  let attempts = 0;
  let error: string | null = null;
  let findings: StageFinding[] = [];
  let guard: StageGuard[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;
    try {
      const value = await opts.work({
        store: opts.store,
        ownerId: opts.ownerId,
        projectId: opts.projectId,
      });

      findings = opts.audit(value);
      guard = opts.guard(value);
      const allPass = findings.every((f) => f.passed) && guard.every((g) => g.passed);

      const completedAt = now();
      const log: StageLog = {
        stage: opts.stage,
        startedAt,
        completedAt,
        attempts,
        passed: allPass,
        findings,
        guard,
        status: allPass ? "passed" : "failed",
        error: null,
      };

      await opts.onLog?.(log);
      if (!opts.onLog) await opts.store.appendStageLog(opts.ownerId, opts.projectId, log, opts.stage);
      if (allPass) {
        return { ok: true, value, log };
      }

      return { ok: false, log };
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
  }

  const completedAt = now();
  const log: StageLog = {
    stage: opts.stage,
    startedAt,
    completedAt,
    attempts,
    passed: false,
    findings,
    guard,
    status: "failed",
    error,
  };

  await opts.onLog?.(log);
  if (!opts.onLog) await opts.store.appendStageLog(opts.ownerId, opts.projectId, log, opts.stage);
  return { ok: false, log };
}

/**
 * Helper to build a guard with threshold comparison.
 */
export function guard(
  name: string,
  value: number,
  threshold: number,
  comparator: ">=" | "<=" | ">" | "<" | "==" = ">=",
): StageGuard {
  let passed = false;
  switch (comparator) {
    case ">=":
      passed = value >= threshold;
      break;
    case "<=":
      passed = value <= threshold;
      break;
    case ">":
      passed = value > threshold;
      break;
    case "<":
      passed = value < threshold;
      break;
    case "==":
      passed = value === threshold;
      break;
  }
  return { name, threshold, value, passed };
}

/**
 * Helper to build a finding.
 */
export function finding(check: string, passed: boolean, evidence: unknown): StageFinding {
  return { check, passed, evidence };
}
