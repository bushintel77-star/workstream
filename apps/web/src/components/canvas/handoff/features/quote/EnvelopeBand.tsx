"use client";

import { useEffect, useState } from "react";
import type { EnvelopeBrief } from "../../../../../lib/api";
import css from "./liveCostRail.module.css";

const aud = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
}).format;

export type EnvelopeBandState = "inside" | "above" | "below";

/**
 * Pure classifier — where does the running total sit inside the survey
 * budget envelope (GET /projects/:id/envelope, ±15/20% bands)?
 * Null when the brief is missing or has no usable band.
 */
export function classifyEnvelope(
  totalInclGst: number,
  envelope: EnvelopeBrief | null,
): { state: EnvelopeBandState; pct: number } | null {
  if (!envelope) return null;
  const low = envelope.budget_low;
  const high = envelope.budget_high;
  if (!(low > 0) || !(high > 0) || high < low) return null;
  if (totalInclGst > high) {
    return { state: "above", pct: (totalInclGst / high - 1) * 100 };
  }
  if (totalInclGst < low) {
    return { state: "below", pct: (1 - totalInclGst / low) * 100 };
  }
  return { state: "inside", pct: 0 };
}

/**
 * Survey budget envelope band for the cost rail — the backend envelope
 * brief (±15/20% of the mid estimate) beside the live total, so drift is
 * visible before the quote leaves the studio.
 */
export function EnvelopeBand({
  projectId,
  totalInclGst,
}: {
  projectId?: string | null;
  totalInclGst: number;
}) {
  const [envelope, setEnvelope] = useState<EnvelopeBrief | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      const { getEnvelopeBriefAction } = await import("../../../../../app/actions");
      const brief = await getEnvelopeBriefAction(projectId);
      if (!cancelled) setEnvelope(brief);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const band = classifyEnvelope(totalInclGst, envelope);
  if (!envelope || !band) return null;

  return (
    <div className={css.envelopeRow} data-testid="live-cost-rail-envelope">
      <span className={css.envelopeLabel}>Survey envelope</span>
      <span className={css.envelopeRange}>
        {aud(envelope.budget_low)}–{aud(envelope.budget_high)}
      </span>
      <span
        className={css.envelopeChip}
        data-state={band.state}
        data-testid="live-cost-rail-envelope-state"
      >
        {band.state === "inside"
          ? "Within band"
          : band.state === "above"
            ? `+${band.pct.toFixed(0)}% over`
            : `−${band.pct.toFixed(0)}% under`}
      </span>
    </div>
  );
}
