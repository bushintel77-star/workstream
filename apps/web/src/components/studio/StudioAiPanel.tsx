"use client";

import Link from "next/link";
import type {
  GhostPlacementSuggestion,
  StudioAiSuggestion,
} from "@workstream/domain";
import ai from "./studioAiPanel.module.css";

type Props = {
  projectId: string;
  tier1: boolean;
  suggestions: StudioAiSuggestion[];
  ghosts: GhostPlacementSuggestion[];
  scanning: boolean;
  onScanSite: () => void;
  onApplyAllGhosts: () => void;
  onClearGhosts: () => void;
  onSuggestionAction: (s: StudioAiSuggestion) => void;
  symbolLabel: (id: string) => string;
};

export function StudioAiPanel({
  projectId,
  tier1,
  suggestions,
  ghosts,
  scanning,
  onScanSite,
  onApplyAllGhosts,
  onClearGhosts,
  onSuggestionAction,
  symbolLabel,
}: Props) {
  const quoteHref = `/projects/${projectId}?mode=quote`;

  return (
    <div className={ai.panel} data-testid="studio-ai-panel">
      <div className={ai.hero}>
        <h3 className={ai.heroTitle}>
          {tier1 ? "Tier-1 AI studio" : "AI-first design"}
        </h3>
        <p className={ai.heroLead}>
          Scan the aerial for suggested symbol ghosts (confirm before save). Save
          the sketch, then open Quote to promote the live BOM.
        </p>
      </div>

      <div className={ai.scanRow}>
        <button
          type="button"
          className={ai.btnPrimary}
          disabled={scanning}
          onClick={onScanSite}
          data-testid="studio-ai-scan"
        >
          {scanning ? "Scanning…" : "Scan site (AI hints)"}
        </button>
        {ghosts.length > 0 ? (
          <>
            <button type="button" className={ai.btnSecondary} onClick={onApplyAllGhosts}>
              Apply all ghosts
            </button>
            <button type="button" className={ai.btnSecondary} onClick={onClearGhosts}>
              Clear ghosts
            </button>
          </>
        ) : null}
        <Link href={quoteHref} className={ai.btnSecondary}>
          Open quote
        </Link>
      </div>

      {ghosts.length > 0 ? (
        <div className={ai.ghostList} aria-label="AI ghost suggestions">
          {ghosts.map((g) => (
            <div key={g.id} className={ai.ghostItem}>
              <span className={ai.ghostMeta}>
                {symbolLabel(g.symbol_id)} — {g.reason}
              </span>
              <span className={ai.ghostConf}>{Math.round(g.confidence * 100)}%</span>
            </div>
          ))}
          <p className={ai.ghostHint}>
            Ghosts are indicative only — not saved until you apply them.
          </p>
        </div>
      ) : (
        <p className={ai.ghostHint}>
          Run a site scan to preview likely planting and TRP positions. Vision API
          batch detection can replace heuristics in a later phase.
        </p>
      )}

      <ul className={ai.list} aria-label="AI coaching">
        {suggestions.map((s) => (
          <li
            key={s.id}
            className={`${ai.card} ${s.priority === "high" ? ai.cardHigh : ""}`}
          >
            <span className={ai.priority}>{s.priority}</span>
            <p className={ai.cardTitle}>{s.title}</p>
            <p className={ai.cardDetail}>{s.detail}</p>
            <button
              type="button"
              className={ai.cardAction}
              onClick={() => onSuggestionAction(s)}
            >
              {actionLabel(s)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function actionLabel(s: StudioAiSuggestion): string {
  switch (s.action) {
    case "develop":
      return "Open quote";
    case "save":
      return "Save plan";
    case "trp":
      return "Arm TRP symbol";
    case "schedule":
      return "Open schedule";
    case "place":
      return s.symbol_id ? "Arm symbol" : "Open library";
    default:
      return "Go";
  }
}
