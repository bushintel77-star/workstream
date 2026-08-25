"use client";

/**
 * RightPanelTabs — Gold Standard 2026
 *
 * A single glass panel on the right that holds BOTH the mode body
 * (survey setup, sketch controls, etc.) and the estimator behind
 * two tabs. This replaces the old dual-panel stack (perimeter-panel
 * + estimator-panel) that consumed 78% of viewport height.
 *
 * Binding: §3 "Spatial UI — 80/20 floating glass chrome"
 */

import { useCallback, type ReactNode } from "react";
import { Button } from "./Button";

export interface RightPanelTabsProps {
  /** The mode-specific content (SurveySetupPanel, SketchBody, etc.) */
  modeBody: ReactNode;
  /** The estimator content (FitSheetCard or EstimatorPanel) */
  estimatorBody: ReactNode;
  /** Label for the mode tab (e.g. "Survey", "Sketch") */
  modeLabel: string;
  /** Active tab — controlled by parent */
  activeTab: "mode" | "estimate";
  /** Tab switch handler */
  onTabChange: (tab: "mode" | "estimate") => void;
  /** Close handler for the × button */
  onClose?: () => void;
  /** Badge count for the mode tab (e.g. "3/5" for survey) */
  modeBadge?: string;
  /** Badge for the estimate tab (e.g. "13 items") */
  estimateBadge?: string;
}

export function RightPanelTabs({
  modeBody,
  estimatorBody,
  modeLabel,
  activeTab,
  onTabChange,
  onClose,
  modeBadge,
  estimateBadge,
}: RightPanelTabsProps) {
  const onMode = useCallback(() => onTabChange("mode"), [onTabChange]);
  const onEstimate = useCallback(() => onTabChange("estimate"), [onTabChange]);

  return (
    <div
      data-testid="right-panel-tabs"
      role="dialog"
      aria-label={`${modeLabel} panel`}
      style={{
        position: "relative",
        pointerEvents: "auto",
        width: "min(340px, calc(100vw - 32px))",
        maxHeight: "min(520px, calc(100dvh - 180px))",
        display: "flex",
        flexDirection: "column",
        borderRadius: "var(--gs-radius-panel)",
        background: "var(--gs-panel-grad)",
        border: "1px solid color-mix(in srgb, var(--la-surface-muted) 55%, transparent)",
        boxShadow: "var(--gs-shadow-2)",
        overflow: "hidden",
        animation: "wsPanelIn 160ms ease-out",
      }}
    >
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Panel tabs"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--gs-space-1)",
          padding: "4px 8px 0",
          borderBottom: "1px solid color-mix(in srgb, var(--la-surface-muted) 40%, transparent)",
          flexShrink: 0,
        }}
      >
        <button
          role="tab"
          aria-selected={activeTab === "mode"}
          aria-controls="panel-mode"
          data-testid="right-panel-tab-mode"
          onClick={onMode}
          style={{
            flex: 1,
            padding: "6px 10px",
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-xs)",
            fontWeight: activeTab === "mode" ? 600 : 400,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: activeTab === "mode" ? "var(--la-ink)" : "var(--la-ink-secondary)",
            background: activeTab === "mode"
              ? "color-mix(in srgb, var(--la-accent) 8%, transparent)"
              : "transparent",
            border: "none",
            borderBottom: activeTab === "mode"
              ? "2px solid var(--la-accent)"
              : "2px solid transparent",
            borderRadius: "var(--gs-radius-chip) var(--gs-radius-chip) 0 0",
            cursor: "pointer",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {modeLabel}
          {modeBadge ? (
            <span
              style={{
                marginLeft: 6,
                padding: "1px 5px",
                borderRadius: "var(--gs-radius-pill)",
                background: "color-mix(in srgb, var(--la-accent) 14%, transparent)",
                color: "var(--la-accent)",
                fontSize: "var(--gs-font-micro)",
                fontWeight: 500,
              }}
            >
              {modeBadge}
            </span>
          ) : null}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "estimate"}
          aria-controls="panel-estimate"
          data-testid="right-panel-tab-estimate"
          onClick={onEstimate}
          style={{
            flex: 1,
            padding: "6px 10px",
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-xs)",
            fontWeight: activeTab === "estimate" ? 600 : 400,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: activeTab === "estimate" ? "var(--la-ink)" : "var(--la-ink-secondary)",
            background: activeTab === "estimate"
              ? "color-mix(in srgb, var(--la-accent) 8%, transparent)"
              : "transparent",
            border: "none",
            borderBottom: activeTab === "estimate"
              ? "2px solid var(--la-accent)"
              : "2px solid transparent",
            borderRadius: "var(--gs-radius-chip) var(--gs-radius-chip) 0 0",
            cursor: "pointer",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          Estimate
          {estimateBadge ? (
            <span
              style={{
                marginLeft: 6,
                padding: "1px 5px",
                borderRadius: "var(--gs-radius-pill)",
                background: "color-mix(in srgb, var(--la-accent) 14%, transparent)",
                color: "var(--la-accent)",
                fontSize: "var(--gs-font-micro)",
                fontWeight: 500,
              }}
            >
              {estimateBadge}
            </span>
          ) : null}
        </button>
        {onClose ? (
          <Button
            variant="icon"
            aria-label="Close panel"
            onClick={onClose}
            style={{ width: 22, height: 22, marginLeft: 4, flexShrink: 0 }}
          >
            ×
          </Button>
        ) : null}
      </div>

      {/* Tab panels */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          scrollbarWidth: "thin",
        }}
      >
        {activeTab === "mode" ? (
          <div
            id="panel-mode"
            role="tabpanel"
            aria-labelledby="right-panel-tab-mode"
            data-testid="panel-mode-body"
            style={{ padding: "10px 12px" }}
          >
            {modeBody}
          </div>
        ) : (
          <div
            id="panel-estimate"
            role="tabpanel"
            aria-labelledby="right-panel-tab-estimate"
            data-testid="panel-estimate-body"
            style={{ padding: "10px 12px" }}
          >
            {estimatorBody}
          </div>
        )}
      </div>
    </div>
  );
}
