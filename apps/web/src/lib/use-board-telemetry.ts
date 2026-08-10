"use client";

import { useCallback, useEffect, useState } from "react";
import type { DesignTelemetryResponse } from "@workstream/contracts";
import {
  designTelemetryAction,
  ingestDesignTelemetryAction,
} from "../app/actions";
import { demoTelemetryIngest } from "@workstream/domain";

const EMPTY: DesignTelemetryResponse = {
  readings: [],
  latest: [],
  count: 0,
};

export type BoardTelemetryState = {
  readings: DesignTelemetryResponse["readings"];
  latest: DesignTelemetryResponse["latest"];
  count: number;
  loading: boolean;
  refresh: () => Promise<void>;
  seedDemo: () => Promise<void>;
};

/**
 * Twin telemetry for the Live telemetry canvas toggle.
 * Refetches when saveRevision bumps or after ingest.
 */
export function useBoardTelemetry(
  projectId: string,
  saveRevision: number,
  enabled = true,
): BoardTelemetryState {
  const [state, setState] = useState<Omit<BoardTelemetryState, "refresh" | "seedDemo">>({
    readings: EMPTY.readings,
    latest: EMPTY.latest,
    count: 0,
    loading: false,
  });

  const load = useCallback(async () => {
    if (!enabled || !projectId) return;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await designTelemetryAction(projectId);
      setState({
        readings: res.readings,
        latest: res.latest,
        count: res.count,
        loading: false,
      });
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [enabled, projectId]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load, saveRevision]);

  const seedDemo = useCallback(async () => {
    if (!projectId) return;
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await ingestDesignTelemetryAction(projectId, {
        readings: demoTelemetryIngest(),
      });
      setState({
        readings: res.readings,
        latest: res.latest,
        count: res.count,
        loading: false,
      });
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [projectId]);

  return {
    ...state,
    refresh: load,
    seedDemo,
  };
}
