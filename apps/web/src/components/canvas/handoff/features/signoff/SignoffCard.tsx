"use client";

import { useEffect, useMemo, useState } from "react";
import type { BoardDisclaimer, ProjectSignoff } from "@workstream/contracts";
import {
  getSignoffAction,
  signOffAction,
} from "../../../../../app/actions";
import css from "./signoff.module.css";

type Props = {
  projectId: string;
  /** Resolved from the board (share-popup disclaimers). */
  disclaimers: BoardDisclaimer[];
  /** Frozen quote total (AUD incl. GST) — estimate.totalInclGst. */
  quoteTotalInclGst: number;
  /** Design revision the signoff binds to (ui.saveRevision). */
  revision: string;
  onSigned?: (signoff: ProjectSignoff) => void;
};

const KIND_LABEL: Record<BoardDisclaimer["kind"], string> = {
  maturity: "Maturity",
  design_intent: "Design intent",
  subsurface: "Subsurface",
  tpo: "Tree protection",
  safety_waiver: "Safety",
};

const aud = (n: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);

/**
 * Screen 4 signoff — a floating Paper Card (canvas-first) that records the
 * durable "issued" state: revision, frozen quote total, and explicit
 * acceptance of every required liability notice. A signoff that cannot point
 * to what it signed stays pending (ground-truth rule).
 */
export function SignoffCard({
  projectId,
  disclaimers,
  quoteTotalInclGst,
  revision,
  onSigned,
}: Props) {
  const [existing, setExisting] = useState<ProjectSignoff | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSignoffAction(projectId)
      .then((res) => {
        if (cancelled) return;
        setExisting(res.signoff);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load signoff state.");
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const required = useMemo(
    () => disclaimers.filter((d) => d.required),
    [disclaimers],
  );
  const allChecked = required.every((d) => checked[d.id] === true);

  const signedOff = existing?.status === "signed_off";

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await signOffAction(projectId, {
        revision,
        quote_total_incl_gst: quoteTotalInclGst,
        accepted_notice_ids: required.map((d) => d.id),
        disclaimers,
        acknowledged: checked,
      });
      setExisting(res.signoff);
      onSigned?.(res.signoff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signoff failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className={css.card} data-testid="signoff-card">
      <p className={css.kicker}>Signoff</p>
      <h2 className={css.title}>
        {signedOff ? "Signed off" : "Issue this design"}
      </h2>

      {signedOff && existing ? (
        <dl className={css.meta}>
          <div>
            <dt>Revision</dt>
            <dd>{existing.revision ?? "—"}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{aud(existing.quote_total_incl_gst)}</dd>
          </div>
          <div>
            <dt>Signed</dt>
            <dd>
              {existing.signed_at
                ? new Date(existing.signed_at).toLocaleDateString("en-AU")
                : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <>
          <p className={css.lead}>
            Signing freezes this design at{" "}
            <strong>
              Rev {revision || "—"} · {aud(quoteTotalInclGst)}
            </strong>
            . Confirm the required notices below — a signoff that cannot point
            to what it signed stays pending.
          </p>

          {required.length > 0 ? (
            <ul className={css.notices}>
              {required.map((d) => (
                <li key={d.id}>
                  <label className={css.noticeRow}>
                    <input
                      type="checkbox"
                      checked={checked[d.id] === true}
                      onChange={(e) =>
                        setChecked((c) => ({
                          ...c,
                          [d.id]: e.target.checked,
                        }))
                      }
                    />
                    <span className={css.noticeText}>
                      <strong>{KIND_LABEL[d.kind] ?? d.kind}</strong>
                      <span>{d.statement}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className={css.lead}>No required notices on this drawing.</p>
          )}

          {error ? (
            <p className={css.error} role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            className={css.primary}
            disabled={!revision || !allChecked || busy}
            onClick={submit}
          >
            {busy ? "Signing…" : "Sign off"}
          </button>
        </>
      )}
    </div>
  );
}
