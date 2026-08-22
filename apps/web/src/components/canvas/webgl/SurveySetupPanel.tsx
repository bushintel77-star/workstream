"use client";

/**
 * Gold Standard 2026 — Survey setup panel (the unified Survey mode body).
 *
 * Survey mode used to render two stacked surfaces in the right dock: an
 * import button and a separate checklist card. This is one panel with the
 * checklist as the primary, actionable focus.
 *
 * Two states, one code path, switched on `setup.complete` so they cannot
 * drift apart:
 *
 *   A — in progress: header + progress bar, the import CTA as the dominant
 *       action (it completes four of the five rows), then the checklist as a
 *       bordered list. Incomplete rows are buttons that route to the tool
 *       that finishes them; complete rows stay in the list, struck through,
 *       so the panel reads as a running record.
 *   B — complete: a success header, "Continue to Sketch" in place of the
 *       import, and the list collapsed to a summary row that expands back.
 *
 * This is a content swap inside the shared perimeter-panel primitive — the
 * panel wrapper, its `data-testid`, `role="dialog"`, close button and
 * `wsPanelIn` animation all stay with the dock (UI survey §1.3 req 1).
 */

import { useState, type CSSProperties } from "react";
import { Button } from "./Button";
import {
  surveySetupPercent,
  type SurveySetup,
  type SurveySetupItem,
} from "./surveySetup";

export interface SurveySetupPanelProps {
  setup: SurveySetup;
  /** Busy while the Vicmap trace is in flight. */
  importBusy: boolean;
  /** Result / error line from the last import attempt. */
  importMessage: string | null;
  onImport: () => void;
  onOpenAssets: () => void;
  onContinue: () => void;
  /**
   * Sketch is only reachable once the survey snapshot carries aerial/title
   * (`hasAerial`, derived server-side). The checklist reaching 5/5 does not
   * itself unlock it, so the CTA states the real blocker instead of failing
   * silently.
   */
  continueEnabled: boolean;
}

const headingStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-tech)",
  fontSize: "var(--gs-font-h3)",
  fontWeight: 600,
  letterSpacing: "0.01em",
  color: "var(--gs-ink)",
};

const countStyle: CSSProperties = {
  fontFamily: "var(--font-tech)",
  fontSize: "var(--gs-font-xs)",
  letterSpacing: "0.04em",
  color: "var(--gs-ink-secondary)",
  fontVariantNumeric: "tabular-nums",
};

const helperStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-xs)",
  lineHeight: 1.4,
  color: "var(--gs-ink-secondary)",
};

const footStyle: CSSProperties = {
  margin: 0,
  fontFamily: "var(--font-ui)",
  fontSize: "var(--gs-font-xs)",
  lineHeight: 1.4,
  color: "var(--gs-ink-muted)",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  border: "1px solid var(--gs-line-soft)",
  borderRadius: "var(--gs-radius-lg)",
  overflow: "hidden",
};

function ProgressBar({ percent, complete }: { percent: number; complete: boolean }) {
  return (
    <div
      data-testid="survey-setup-bar"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        height: 4,
        borderRadius: "var(--gs-radius-pill)",
        background: "var(--gs-line-soft)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${percent}%`,
          height: "100%",
          borderRadius: "var(--gs-radius-pill)",
          background: complete ? "var(--gs-success)" : "var(--gs-primary)",
          transition: "width var(--gs-base)",
        }}
      />
    </div>
  );
}

function Mark({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        flex: "0 0 auto",
        width: 16,
        height: 16,
        marginTop: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--gs-radius-pill)",
        border: done ? "1px solid var(--gs-success)" : "1px solid var(--gs-line-strong)",
        background: done ? "var(--gs-success)" : "transparent",
        color: "var(--gs-panel)",
        fontFamily: "var(--font-tech)",
        fontSize: "var(--gs-font-micro)",
        lineHeight: 1,
      }}
    >
      {done ? "✓" : ""}
    </span>
  );
}

function SetupRow({
  item,
  last,
  onAct,
}: {
  item: SurveySetupItem;
  last: boolean;
  onAct: (item: SurveySetupItem) => void;
}) {
  const [hot, setHot] = useState(false);
  const rowPadding = "8px 10px";
  const border = last ? undefined : "1px solid var(--gs-line-soft)";

  if (item.done) {
    return (
      <li
        data-testid={`survey-row-${item.id}`}
        data-done="true"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--gs-space-3)",
          padding: rowPadding,
          borderBottom: border,
        }}
      >
        <Mark done />
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "var(--gs-font-sm)",
            color: "var(--gs-ink-muted)",
            textDecoration: "line-through",
          }}
        >
          {item.label}
        </span>
      </li>
    );
  }

  return (
    <li style={{ borderBottom: border }}>
      <button
        type="button"
        data-testid={`survey-row-${item.id}`}
        data-done="false"
        aria-label={`${item.label} — ${item.actionLabel}`}
        onClick={() => onAct(item)}
        onMouseEnter={() => setHot(true)}
        onMouseLeave={() => setHot(false)}
        onFocus={() => setHot(true)}
        onBlur={() => setHot(false)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--gs-space-3)",
          padding: rowPadding,
          border: 0,
          background: hot ? "var(--gs-primary-veil)" : "transparent",
          textAlign: "left",
          cursor: "pointer",
          transition: "background var(--gs-fast)",
        }}
      >
        <Mark done={false} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-ui)",
              fontSize: "var(--gs-font-sm)",
              color: "var(--gs-ink)",
            }}
          >
            {item.label}
          </span>
          <span
            style={{
              display: "block",
              fontFamily: "var(--font-ui)",
              fontSize: "var(--gs-font-xs)",
              lineHeight: 1.35,
              color: "var(--gs-ink-secondary)",
            }}
          >
            {item.helper}
          </span>
        </span>
        <span
          aria-hidden
          style={{
            flex: "0 0 auto",
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-sm)",
            color: "var(--gs-primary-ink)",
            opacity: hot ? 1 : 0,
            transition: "opacity var(--gs-fast)",
          }}
        >
          ›
        </span>
      </button>
    </li>
  );
}

export function SurveySetupPanel({
  setup,
  importBusy,
  importMessage,
  onImport,
  onOpenAssets,
  onContinue,
  continueEnabled,
}: SurveySetupPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const percent = surveySetupPercent(setup);
  const complete = setup.complete;

  const act = (item: SurveySetupItem) => {
    if (item.action === "assets") {
      onOpenAssets();
      return;
    }
    onImport();
  };

  const showList = !complete || expanded;

  return (
    <div
      data-testid="survey-setup-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--gs-space-4)",
      }}
    >
      {/* Header — title, progress bar, X of N. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-3)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "var(--gs-space-3)",
            // The shared panel's close button floats at top-right (22px at
            // inset 6) — clear it or the count renders underneath.
            paddingRight: 26,
          }}
        >
          <h2 style={headingStyle}>
            {complete ? "Site set up" : "Set up your site"}
          </h2>
          <span data-testid="survey-setup-count" style={countStyle}>
            {setup.done} of {setup.total} complete
          </span>
        </div>
        <ProgressBar percent={percent} complete={complete} />
      </div>

      {/* Primary action — import while capturing, continue once captured. */}
      {complete ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-2)" }}>
          <Button
            variant="primary"
            active={continueEnabled}
            data-testid="survey-continue-sketch"
            disabled={!continueEnabled}
            onClick={onContinue}
            style={{ justifyContent: "center", padding: "7px 10px" }}
          >
            Continue to Sketch →
          </Button>
          {!continueEnabled ? (
            <p style={helperStyle}>
              Sketch opens once the survey carries aerial and title imagery.
            </p>
          ) : null}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gs-space-2)" }}>
          <Button
            variant="primary"
            active
            data-testid="import-site-truth"
            disabled={importBusy}
            onClick={onImport}
            style={{
              justifyContent: "center",
              padding: "7px 10px",
              cursor: importBusy ? "wait" : "pointer",
              opacity: importBusy ? 1 : undefined,
            }}
          >
            {importBusy ? "Tracing Vicmap…" : "Import site truth"}
          </Button>
          <p style={helperStyle}>
            Pulls the title boundary, dwelling footprint, easements and
            indicative levels from the Vicmap cadastre — four of the five
            items below.
          </p>
          {importMessage ? (
            <p
              role="status"
              data-testid="site-truth-result"
              style={{ ...helperStyle, color: "var(--gs-ink)" }}
            >
              {importMessage}
            </p>
          ) : null}
        </div>
      )}

      {/* Checklist — full list while capturing, collapsed summary once done. */}
      {complete ? (
        <ul style={listStyle}>
          <li>
            <button
              type="button"
              data-testid="survey-summary-row"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "var(--gs-space-3)",
                padding: "8px 10px",
                border: 0,
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                borderBottom: expanded ? "1px solid var(--gs-line-soft)" : undefined,
              }}
            >
              <Mark done />
              <span
                style={{
                  flex: 1,
                  fontFamily: "var(--font-ui)",
                  fontSize: "var(--gs-font-sm)",
                  color: "var(--gs-ink)",
                }}
              >
                Site details · {setup.done} of {setup.total}
              </span>
              <span
                aria-hidden
                style={{
                  fontFamily: "var(--font-tech)",
                  fontSize: "var(--gs-font-sm)",
                  color: "var(--gs-ink-secondary)",
                }}
              >
                {expanded ? "▾" : "▸"}
              </span>
            </button>
          </li>
          {showList
            ? setup.items.map((item, i) => (
                <SetupRow
                  key={item.id}
                  item={item}
                  last={i === setup.items.length - 1}
                  onAct={act}
                />
              ))
            : null}
        </ul>
      ) : (
        <ul style={listStyle}>
          {setup.items.map((item, i) => (
            <SetupRow
              key={item.id}
              item={item}
              last={i === setup.items.length - 1}
              onAct={act}
            />
          ))}
        </ul>
      )}

      <p style={footStyle}>
        {complete
          ? "You can revisit these anytime from Site."
          : "Sketch and CAD unlock once the survey carries aerial and title data."}
      </p>
    </div>
  );
}
