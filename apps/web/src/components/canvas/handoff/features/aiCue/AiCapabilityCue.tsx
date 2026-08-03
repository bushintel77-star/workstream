"use client";

import { useCallback, useEffect, useState } from "react";
import {
  aiCueStorageKey,
  nextAiCue,
  parseSeen,
  type AiCapabilityId,
  type AiCueContext,
} from "./aiCuePolicy";
import css from "./aiCue.module.css";

type Props = {
  projectId: string;
  /** Everything the policy needs, minus the acknowledgement set. */
  context: Omit<AiCueContext, "seen">;
  laneBusy: boolean;
  /**
   * Run the scan pass. Both cue moments dispatch the same `ai.scan()` — the id
   * is passed so the caller can attribute which moment prompted it, not to
   * select a different engine call.
   */
  onRun: (id: AiCapabilityId) => void;
};

/**
 * Contextual cue for AI capabilities that have no other surface.
 *
 * Renders nothing unless a capability is both applicable and unacknowledged —
 * see `aiCuePolicy.ts` for the policy and the reasoning. Acknowledgement is
 * per project and persisted, so a cue teaches once and then the app is
 * indistinguishable from one without the feature (§6 item 11).
 */
export function AiCapabilityCue({
  projectId,
  context,
  laneBusy,
  onRun,
}: Props) {
  const [seen, setSeen] = useState<AiCapabilityId[] | null>(null);

  // Read acknowledgements after mount — localStorage is not available during
  // SSR, and `null` until read keeps the cue from flashing on hydration.
  useEffect(() => {
    try {
      setSeen(parseSeen(localStorage.getItem(aiCueStorageKey(projectId))));
    } catch {
      setSeen([]);
    }
  }, [projectId]);

  const acknowledge = useCallback(
    (id: AiCapabilityId) => {
      setSeen((prev) => {
        const next = prev ? [...prev, id] : [id];
        try {
          localStorage.setItem(
            aiCueStorageKey(projectId),
            JSON.stringify(next),
          );
        } catch {
          /* private mode — the cue simply returns next session */
        }
        return next;
      });
    },
    [projectId],
  );

  if (seen == null) return null;

  const cue = nextAiCue({ ...context, seen });
  if (!cue) return null;

  return (
    <aside
      className={css.cue}
      data-testid="ai-capability-cue"
      data-capability={cue.id}
      data-lane={laneBusy ? "busy" : "free"}
      aria-label="Assistant suggestion"
    >
      <p className={css.kicker}>Assistant</p>
      <p className={css.title}>{cue.title}</p>
      <p className={css.body}>{cue.body}</p>
      <div className={css.actions}>
        <button
          type="button"
          className={css.primary}
          data-testid="ai-capability-cue-run"
          onClick={() => {
            acknowledge(cue.id);
            onRun(cue.id);
          }}
        >
          {cue.action}
        </button>
        <button
          type="button"
          className={css.dismiss}
          data-testid="ai-capability-cue-dismiss"
          onClick={() => acknowledge(cue.id)}
        >
          Not now
        </button>
      </div>
    </aside>
  );
}
