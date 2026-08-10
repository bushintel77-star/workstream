"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  BoardDisclaimer,
  BoardSustainability,
} from "@workstream/contracts";
import { designBoardReportAction } from "../app/actions";

const EMPTY_SUSTAINABILITY: BoardSustainability = {
  metrics: [],
  measured: 0,
  assessed: 0,
};

export type BoardReportState = {
  sustainability: BoardSustainability;
  disclaimers: BoardDisclaimer[];
  gaps: string[];
  loading: boolean;
};

/**
 * Sustainability read-out + export disclaimers, refetched whenever the board is
 * persisted.
 *
 * Both read the *saved* board server-side (canvas + survey + costing + rate
 * card), so `saveRevision` — bumped on every durable save — is the refetch key,
 * exactly as it is for the findings. The studio hook must never import lib/api
 * (Clerk / async_hooks breaks the Docker build), so this goes through the
 * `designBoardReportAction` server action.
 *
 * Errors keep the last good result rather than blanking the panel — a failed
 * poll should never erase a disclaimer the operator was about to act on.
 */
export function useBoardReport(
  projectId: string,
  saveRevision: number,
  enabled = true,
): BoardReportState {
  const [state, setState] = useState<BoardReportState>({
    sustainability: EMPTY_SUSTAINABILITY,
    disclaimers: [],
    gaps: [],
    loading: false,
  });

  const load = useCallback(async () => {
    if (!enabled || !projectId) return;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await designBoardReportAction(projectId);
      setState({
        sustainability: res.sustainability,
        disclaimers: res.disclaimers,
        gaps: res.gaps,
        loading: false,
      });
    } catch {
      // Keep the last good report; just clear the in-flight flag.
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [enabled, projectId]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load, saveRevision]);

  return state;
}
