"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { KitButton } from "./ui/kit/KitButton";
import styles from "../app/projects/[id]/project.module.css";

/**
 * Voice capture upload (POST /projects/:id/recordings) — the entry to the
 * backend capture pipeline (transcribe → survey → design → cost → audit).
 * Duration auto-detects from the file's audio metadata; DIL consent is
 * required before transcription analysis (backend rejects without it).
 */
export function RecordingUpload({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [durationS, setDurationS] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  // Auto-read duration from the file's metadata (no upload needed).
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = url;
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDurationS(Math.round(audio.duration));
      }
    };
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    };
  }, [file]);

  const submit = async () => {
    if (!file || !durationS || durationS <= 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("audio", file);
      body.append("duration_s", String(durationS));
      body.append("dil_consent", consent ? "true" : "false");
      const res = await fetch(`/api/projects/${projectId}/recordings`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `Upload failed (${res.status})`);
      }
      setAccepted(true);
      setFile(null);
      setConsent(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.card} aria-labelledby="recording-upload-heading">
      <h2 id="recording-upload-heading" className={styles.sectionHeading}>
        Capture a site note
      </h2>
      <p className={styles.processingCopy}>
        Upload a voice note to run the capture pipeline — transcription feeds
        survey, design, and cost in the background.
      </p>
      <div className={styles.taskNewForm}>
        <label className={styles.label}>
          Audio note (m4a / webm / mp3…)
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              setAccepted(false);
              setError(null);
              setFile(e.target.files?.[0] ?? null);
              setDurationS(null);
            }}
            data-testid="recording-file"
          />
        </label>
        <label className={styles.label}>
          Duration (seconds)
          <input
            type="number"
            min={1}
            max={3600}
            value={durationS ?? ""}
            onChange={(e) =>
              setDurationS(e.target.value ? Number(e.target.value) : null)
            }
            placeholder="auto-detected from the file"
            data-testid="recording-duration"
          />
        </label>
        <label className={styles.label}>
          <span className={styles.overrideSummary} style={{ listStyle: "none" }}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              data-testid="recording-consent"
            />{" "}
            Dictation-in-lieu consent — spoken content may be transcribed and
            analysed for this project.
          </span>
        </label>
        <KitButton
          variant="accent"
          loading={busy}
          disabled={!file || !durationS || durationS <= 0 || !consent}
          onClick={submit}
          data-testid="recording-submit"
        >
          {busy ? "Uploading…" : "Upload + start capture"}
        </KitButton>
        {error ? (
          <p className={styles.findingAction} role="alert">
            {error}
          </p>
        ) : null}
        {accepted ? (
          <p className={styles.totalSub} role="status">
            Uploaded — the capture pipeline is running in the background.
          </p>
        ) : null}
      </div>
    </section>
  );
}
