"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { KitButton } from "./ui/kit/KitButton";
import styles from "../app/projects/[id]/project.module.css";

/**
 * Vision photo measurement capture (POST /projects/:id/measurements/photo).
 * A site photo + optional reference hint → Claude vision quantities with
 * confidence + reference annotations. The drawing's measure tape stays on
 * canvas; this surface covers "I have a photo from the walk-through".
 */
export function PhotoMeasureUpload({ projectId }: { projectId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const pickFile = (f: File | null | undefined) => {
    setError(null);
    setDone(false);
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(f.type)) {
      setFile(null);
      setError("Use a JPEG, PNG, or WEBP photo.");
      return;
    }
    setFile(f);
  };

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("photo", file);
      if (hint.trim()) body.append("hint", hint.trim());
      const res = await fetch(`/api/projects/${projectId}/measurements`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? `Upload failed (${res.status})`);
      }
      setDone(true);
      setFile(null);
      setHint("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={styles.card}
      aria-labelledby="photo-measure-heading"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      data-drag={dragOver ? "over" : "idle"}
    >
      <h2 id="photo-measure-heading" className={styles.sectionHeading}>
        Measure from a photo
      </h2>
      <p className={styles.processingCopy}>
        Drop a site photo — vision returns quantities with a stated reference
        and confidence. Indicative until confirmed against tape or survey.
      </p>
      <div className={styles.taskNewForm}>
        <label className={styles.label}>
          Site photo (JPEG / PNG / WEBP)
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              pickFile(e.target.files?.[0])
            }
            data-testid="photo-measure-file"
          />
        </label>
        <label className={styles.label}>
          Reference hint (optional)
          <input
            type="text"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="e.g. the door is 2.04 m; the paver is 400 mm"
            data-testid="photo-measure-hint"
          />
        </label>
        <KitButton
          variant="accent"
          loading={busy}
          disabled={!file}
          onClick={submit}
          data-testid="photo-measure-submit"
        >
          {busy ? "Measuring…" : "Measure photo"}
        </KitButton>
        {error ? (
          <p className={styles.findingAction} role="alert">
            {error}
          </p>
        ) : null}
        {done ? (
          <p className={styles.totalSub} role="status">
            Measurement captured — listed below.
          </p>
        ) : null}
      </div>
    </section>
  );
}
