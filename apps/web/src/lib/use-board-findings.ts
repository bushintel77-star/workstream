"use client";

import { useCallback, useEffect, useState } from "react";
import type { BoardFinding } from "@workstream/contracts";
import { designFindingsAction } from "../app/actions";

export type BoardFindingsState = {
  findings: BoardFinding[];
  gaps: string[];
  loading: boolean;
};

/**
 * Cross-artefact board findings, refetched whenever the board is persisted.
 *
 * The findings read the *saved* board server-side (canvas + survey + costing +
 * rate card), so `saveRevision` — bumped on every durable save — is the refetch
 * key. The studio hook must never import lib/api (Clerk / async_hooks breaks the
 * Docker build), so this goes through the `designFindingsAction` server action.
 *
 * Errors keep the last good result rather than blanking the panel — a failed
 * poll should never erase a warning the operator was reading.
 */
export function useBoardFindings(
  projectId: string,
  saveRevision: number,
  enabled = true,
): BoardFindingsState {
  const [state, setState] = useState<BoardFindingsState>({
    findings: [],
    gaps: [],
    loading: false,
  });

  const load = useCallback(async () => {
    if (!enabled || !projectId) return;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await designFindingsAction(projectId);
      setState({ findings: res.findings, gaps: res.gaps, loading: false });
    } catch {
      // Keep the last good findings; just clear the in-flight flag.
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [enabled, projectId]);

  useEffect(() => {
    void load();
  }, [load, saveRevision]);

  return state;
}
