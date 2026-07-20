"use client";

import type { StudioAiSuggestion } from "@workstream/domain";
import type { AiDraftStatus } from "../../state/studioAiEngine";
import css from "./aiCoachDock.module.css";

type Props = {
  open: boolean;
  status: AiDraftStatus;
  coaching: StudioAiSuggestion[];
  pendingCount: number;
  busy: "idle" | "scanning" | "assisting";
  assistReply: string | null;
  onClose: () => void;
  onScan: () => void;
  onAsk: () => void;
  onReview: () => void;
  onAcceptAll: () => void;
  onTipAction: (tip: StudioAiSuggestion) => void;
};

const STATUS_LABEL: Record<AiDraftStatus, string> = {
  unverified: "Still a draft — review suggestions when ready",
  verified: "Looking good — suggestions cleared",
  scanning: "Looking at the site…",
  assisting: "Thinking with you…",
}

/**
 * Primary AI coach rail — live coaching from the drawing, not a toast bolt-on.
 */
export function AiCoachDock({
  open,
  status,
  coaching,
  pendingCount,
  busy,
  assistReply,
  onClose,
  onScan,
  onAsk,
  onReview,
  onAcceptAll,
  onTipAction,
}: Props) {
  if (!open) return null;

  return (
    <aside className={css.dock} data-testid="ai-coach-dock" aria-label="AI coach">
      <div className={css.head}>
        <div>
          <p className={css.kicker}>AI coach</p>
          <p
            className={`${css.status}${status === "verified" ? ` ${css.statusOk}` : ""}${busy !== "idle" ? ` ${css.statusBusy}` : ""}`}
            data-testid="ai-coach-status"
          >
            {STATUS_LABEL[status]}
          </p>
        </div>
        <button type="button" className={css.close} onClick={onClose} aria-label="Close coach">
          ×
        </button>
      </div>

      {assistReply ? (
        <p className={css.reply} data-testid="ai-assist-reply">
          {assistReply}
        </p>
      ) : null}

      <ul className={css.tips}>
        {coaching.map((tip) => (
          <li key={tip.id}>
            <button
              type="button"
              className={`${css.tip}${tip.priority === "high" ? ` ${css.tipHigh}` : ""}`}
              onClick={() => onTipAction(tip)}
            >
              <span className={css.tipTitle}>{tip.title}</span>
              <span className={css.tipDetail}>{tip.detail}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className={css.actions}>
        <button
          type="button"
          className={css.primary}
          data-testid="ai-coach-scan"
          disabled={busy !== "idle"}
          onClick={onScan}
        >
          {busy === "scanning" ? "Scanning…" : "Scan site"}
        </button>
        <button
          type="button"
          className={css.secondary}
          data-testid="ai-coach-ask"
          disabled={busy !== "idle"}
          onClick={onAsk}
        >
          Ask AI
        </button>
        {pendingCount > 0 ? (
          <>
            <button
              type="button"
              className={css.secondary}
              data-testid="ai-coach-review"
              onClick={onReview}
            >
              Review {pendingCount}
            </button>
            <button
              type="button"
              className={css.secondary}
              data-testid="ai-coach-accept-all"
              onClick={onAcceptAll}
            >
              Accept all
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}
