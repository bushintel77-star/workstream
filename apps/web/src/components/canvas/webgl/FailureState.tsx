"use client";

/**
 * Phase O — Error and empty states (spec "Open before the sprint starts" item 2).
 *
 * The spec lists this as a blocking open item: "only WFS failure is drawn.
 * Failed import, empty schedule, corrupt underlay, rejected calibration are
 * not." Each failure mode gets a drawn state that names what failed and
 * offers retry or dismiss. No failure is silent.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase O.
 */

import { type CSSProperties, type ReactNode } from "react";
import styles from "./FailureState.module.css";

export type FailureKind =
  | "failed-import"
  | "empty-schedule"
  | "corrupt-underlay"
  | "rejected-calibration";

export interface FailureStateProps {
  kind: FailureKind;
  /** What failed, in one short line. */
  title: string;
  /** Longer detail — why it failed and what the operator can do. */
  detail: string;
  /** Source/provenance stamp (e.g. "BYDA · fetched 14:02"). */
  source?: string;
  /** Retry handler. When omitted, the retry button is hidden. */
  onRetry?: () => void;
  /** Dismiss handler. When omitted, the dismiss button is hidden. */
  onDismiss?: () => void;
  /** Test id for the root element. */
  testId?: string;
  /** Optional children rendered below the detail (e.g. a partial result). */
  children?: ReactNode;
}

/**
 * The shell spans the canvas so the card can be centred, but it must NOT
 * swallow pointer events: `pointerEvents: "auto"` on a full-bleed `inset: 0`
 * layer made every failure behave as a modal — the operator could not pan,
 * draw or click anything until it was dismissed — while looking like a
 * non-modal card. The shell is transparent to the pointer; the card itself
 * re-enables it (`.card { pointer-events: auto }`) so its buttons work.
 */
const shellStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  padding: 24,
  pointerEvents: "none",
  zIndex: "var(--cf-z-chrome)",
};

/**
 * A drawn failure/empty state. Replaces the silent fallback (a bare fill or
 * a console.error) with a named, actionable surface. The operator can see
 * what failed, why, and what to do next.
 */
export function FailureState({
  kind,
  title,
  detail,
  source,
  onRetry,
  onDismiss,
  testId,
  children,
}: FailureStateProps) {
  return (
    <section
      role="alert"
      aria-live="assertive"
      data-testid={testId ?? `failure-${kind}`}
      data-failure-kind={kind}
      style={shellStyle}
    >
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.kindLabel}>{KIND_LABEL[kind]}</span>
          {source && <span className={styles.sourceStamp}>{source}</span>}
        </div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.detail}>{detail}</p>
        {children}
        <div className={styles.actions}>
          {onRetry && (
            <button
              className={styles.actionBtn}
              onClick={onRetry}
              data-action="retry"
            >
              Retry
            </button>
          )}
          {onDismiss && (
            <button
              className={styles.actionBtn}
              onClick={onDismiss}
              data-action="dismiss"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

const KIND_LABEL: Record<FailureKind, string> = {
  "failed-import": "FAILED IMPORT",
  "empty-schedule": "EMPTY SCHEDULE",
  "corrupt-underlay": "CORRUPT UNDERLAY",
  "rejected-calibration": "REJECTED CALIBRATION",
};
