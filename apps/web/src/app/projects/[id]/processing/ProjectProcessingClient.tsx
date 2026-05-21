"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pollProjectProgressAction } from "../../../actions";
import {
  ProjectPipelineProgress,
  buildPipelineStages,
} from "../../../../components/ProjectPipelineProgress";
import s from "../../../../styles/app.module.css";
import p from "../project.module.css";

export function ProjectProcessingClient({
  projectId,
  address,
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
        if (pollRef.current) clearInterval(pollRef.current);
        if (slowRef.current) clearTimeout(slowRef.current);
        router.replace(`/projects/${projectId}`);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed");
    }
  }, [projectId, router]);

  useEffect(() => {
    void tick();
    slowRef.current = setTimeout(() => setSlow(true), 90_000);
    pollRef.current = setInterval(() => void tick(), 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (slowRef.current) clearTimeout(slowRef.current);
    };
  }, [tick]);

  const stages = buildPipelineStages({
    hasTranscript,
    hasSurvey,
    hasDesign,
    hasCosting,
    hasAudit,
    status,
  });

  return (
    <main className={s.page}>
      <header className={s.masthead}>
        <div className={s.brand}>
          {address}
          <span className={s.brandSub}>Processing walkthrough</span>
        </div>
        <Link href={`/projects/${projectId}`} className={s.crumb}>
          ← Project
        </Link>
      </header>

      <h1 className={s.headline}>Turning your walkthrough into a job</h1>
      <p className={s.lede}>
        Transcription, survey, design, costing and audit run automatically.
        Stay on this screen — you will land on the project hub when ready.
      </p>

      <ProjectPipelineProgress
        stages={stages}
        slow={slow}
        error={error}
        onRetry={() => {
          setError(null);
          void tick();
        }}
      />

      <p className={p.processingHint}>
        <Link href={`/projects/${projectId}/recordings`} className={s.crumb}>
          View recordings
        </Link>
        {" · "}
        Safe to leave — open the project later from the dashboard.
      </p>
    </main>
  );
}
