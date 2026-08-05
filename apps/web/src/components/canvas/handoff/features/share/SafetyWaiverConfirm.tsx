"use client";

import { useRef } from "react";
import type { BoardDisclaimer } from "@workstream/contracts";
import { useFocusTrap } from "@/lib/use-focus-trap";
import css from "./safetyWaiverConfirm.module.css";

type Props = {
  disclaimer: BoardDisclaimer | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Hard confirm on the safety waiver, and only on the safety waiver.
 *
 * Every other export notice is soft — the tool infers them from geometry, it
 * can be wrong, and blocking an issue on a wrong inference costs the practice
 * more than it saves. This one is different: a compliant barrier is a legal
 * requirement rather than a recommendation, so a set leaving without the notice
 * answered is the practice's highest single exposure. It gets a decision, not a
 * warning banner someone scrolls past.
 *
 * It still does not refuse. The operator can issue the set after reading the
 * notice — the point is that they read it and chose, and that the choice was
 * theirs rather than the tool's.
 */
export function SafetyWaiverConfirm({
  disclaimer,
  onConfirm,
  onCancel,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  // Cancel is the first focusable in .card DOM order (precedes Confirm), so
  // the hook's generic autofocus lands on Cancel — the safe default.
  // Tab-trap also closes the gap where Tab could reach content behind the
  // scrim (there is no click-outside dismiss by design — a hard confirm is
  // answered, not escaped past — and an un-trapped Tab undermined that).
  useFocusTrap(Boolean(disclaimer), cardRef, onCancel);

  if (!disclaimer) return null;

  return (
    /* No click-outside dismiss — a hard confirm is answered, not escaped past. */
    <div className={css.scrim} data-testid="safety-waiver-confirm">
      <div
        className={css.card}
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="safety-waiver-title"
        aria-describedby="safety-waiver-body"
      >
        <p className={css.kicker}>Safety notice</p>
        <h2 className={css.title} id="safety-waiver-title">
          {disclaimer.title}
        </h2>
        <p className={css.trigger}>Triggered by {disclaimer.trigger}.</p>
        <p className={css.statement} id="safety-waiver-body">
          {disclaimer.statement}
        </p>
        <p className={css.ask}>
          Issuing this set without acknowledging the notice is your call to make
          — confirm you have read it.
        </p>
        <div className={css.actions}>
          <button
            type="button"
            className={css.cancel}
            data-testid="safety-waiver-cancel"
            onClick={onCancel}
          >
            Back to the drawing
          </button>
          <button
            type="button"
            className={css.confirm}
            data-testid="safety-waiver-confirm-share"
            onClick={onConfirm}
          >
            Acknowledge and share
          </button>
        </div>
      </div>
    </div>
  );
}
