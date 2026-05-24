"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  pollProjectProgressAction,
  restartPipelineAction,
} from "../../../actions";
import {
  ProjectPipelineProgress,
  buildPipelineStages,
} from "../../../../components/ProjectPipelineProgress";
import s from "../../../../styles/app.module.css";
import p from "../project.module.css";

export function ProjectProcessingClient({
  projectId,
}: {
  projectId: string;
  address: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>("processing");
  const [hasTranscript, setHasTranscript] = useState(false);
  const [hasSurvey, setHasSurvey] = useState(false);
  const [hasDesign, setHasDesign] = useState(false);
  const [hasCosting, setHasCosting] = useState(false);
  const [hasAudit, setHasAudit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (slowRef.current) {
      clearTimeout(slowRef.current);
      slowRef.current = null;
    }
  }, []);

  const tick = useCallback(async () => {
    try {
      const data = await pollProjectProgressAction(projectId);
      setStatus(data.status);
      setHasTranscript(data.hasTranscript);
      setHasSurvey(data.hasSurvey);
      setHasDesign(data.hasDesign);
      setHasCosting(data.hasCosting);
      setHasAudit(data.hasAudit);
      setError(null);

      if (data.ready) {
        clearTimers();
        router.replace(`/projects/${projectId}`);
        router.refresh();
        return;
      }

      if (data.status !== "processing") {
        clearTimers();
        setError(
          "Processing stopped before every stage completed. Retry to restart the pipeline.",
        );
      }
    } catch {
      clearTimers();
      setError("Could not refresh processing status. Retry to check again.");
    }
  }, [clearTimers, projectId, router]);

  const startPolling = useCallback(() => {
    clearTimers();
    void tick();
    slowRef.current = setTimeout(() => setSlow(true), 90_000);
    pollRef.current = setInterval(() => void tick(), 1500);
  }, [clearTimers, tick]);

  useEffect(() => {
    startPolling();
    return clearTimers;
  }, [clearTimers, startPolling]);

  const stages = buildPipelineStages({
    hasTranscript,
    hasSurvey,
    hasDesign,
    hasCosting,
    hasAudit,
    status,
  });

  return (
    <>
      <h1 className={s.headline}>Turning your walkthrough into a job</h1>
      <p className={s.lede}>
        Transcription, survey, design, costing and audit run automatically.
        Stay on this screen — you will land on the project hub when ready.
      </p>

      <ProjectPipelineProgress
        stages={stages}
        slow={slow}
        error={error}
        onRetry={async () => {
          clearTimers();
          setError(null);
          setSlow(false);
          setStatus("processing");
          try {
            await restartPipelineAction(projectId);
            startPolling();
          } catch {
            setError("Could not restart processing. Try again in a moment.");
          }
        }}
      />

      <p className={p.processingHint}>
        <Link href={`/projects/${projectId}/recordings`} className={s.crumb}>
          View recordings
        </Link>
        {" · "}
        Safe to leave — open the project later from the dashboard.
      </p>
    </>
  );
}
