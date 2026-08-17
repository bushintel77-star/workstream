import type {
  BoardDisclaimer,
  ProjectSignoff,
  SignoffMissingReason,
  SignoffReadiness,
} from "@workstream/contracts";

/**
 * Project signoff — Screen 4's durable "issued" state.
 *
 * A signoff is only valid when it is bound to a design revision, a frozen quote
 * total, and explicit acceptance of every required liability notice. This is
 * the ground-truth rule applied to the issue itself: a signoff that cannot
 * point to what it signed is not a signoff.
 *
 * The hard/soft gate mirrors the share surface's duty-of-care rules: only a
 * required safety waiver hard-blocks (a barrier is a legal requirement), the
 * rest warn but never block.
 */

/** Only a required safety waiver hard-stops the issue. */
function isHardGate(d: BoardDisclaimer): boolean {
  return d.kind === "safety_waiver" && d.required;
}

export type SignoffGate = {
  hardConfirm: BoardDisclaimer | null;
  softOutstanding: number;
};

/** Notices still unanswered and whether any of them is a hard gate. */
export function resolveSignoffGate(
  disclaimers: BoardDisclaimer[],
  acknowledged: Record<string, boolean>,
): SignoffGate {
  const unanswered = disclaimers.filter(
    (d) => d.required && acknowledged[d.id] !== true,
  );
  return {
    hardConfirm: unanswered.find(isHardGate) ?? null,
    softOutstanding: unanswered.filter((d) => !isHardGate(d)).length,
  };
}

export type SignoffReadinessInput = {
  disclaimers: BoardDisclaimer[];
  acknowledged: Record<string, boolean>;
  revision: string | null;
  quoteTotalInclGst: number | null;
  existing: ProjectSignoff | null;
};

/**
 * Pure readiness check — what is still missing before this project can be
 * signed off. Never mutates; the caller decides what to do with the result.
 */
export function signoffReadiness(
  input: SignoffReadinessInput,
): SignoffReadiness {
  const { disclaimers, acknowledged, revision, quoteTotalInclGst, existing } =
    input;

  if (existing?.status === "signed_off") {
    return {
      ready: true,
      signed_off: true,
      missing: [],
      hard_confirm_notice_id: null,
      soft_outstanding: 0,
    };
  }

  const gate = resolveSignoffGate(disclaimers, acknowledged);
  const missing: SignoffMissingReason[] = [];
  if (!revision) missing.push("revision");
  if (quoteTotalInclGst == null || quoteTotalInclGst <= 0) missing.push("quote");
  if (gate.hardConfirm || gate.softOutstanding > 0) missing.push("notices");

  return {
    ready: missing.length === 0,
    signed_off: false,
    missing,
    hard_confirm_notice_id: gate.hardConfirm?.id ?? null,
    soft_outstanding: gate.softOutstanding,
  };
}

export type CreateSignoffRecordInput = {
  projectId: string;
  revision: string;
  quoteTotalInclGst: number;
  acceptedNoticeIds: string[];
  signedBy: string;
  now?: string;
};

/**
 * Produce the immutable signed-off record. Throws when the inputs are not
 * internally consistent (a caller that used `signoffReadiness` first should
 * never hit this) — a signoff is never fabricated.
 */
export function createSignoffRecord(
  input: CreateSignoffRecordInput,
): ProjectSignoff {
  const {
    projectId,
    revision,
    quoteTotalInclGst,
    acceptedNoticeIds,
    signedBy,
    now = new Date().toISOString(),
  } = input;

  if (!revision) {
    throw new Error("Cannot sign off without a design revision");
  }
  if (!(quoteTotalInclGst > 0)) {
    throw new Error("Cannot sign off without a quote total");
  }

  return {
    id: crypto.randomUUID(),
    project_id: projectId,
    status: "signed_off",
    revision,
    accepted_notice_ids: [...new Set(acceptedNoticeIds)],
    quote_total_incl_gst: quoteTotalInclGst,
    signed_at: now,
    signed_by: signedBy,
    updated_at: now,
  };
}
