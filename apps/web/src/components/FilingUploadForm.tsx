"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ProjectFileKind } from "../lib/api";
import s from "../styles/app.module.css";
import { useToast } from "./ToastHost";

const KINDS: Array<{ value: ProjectFileKind; label: string }> = [
  { value: "plan", label: "Plan" },
  { value: "design", label: "Design" },
  { value: "site_photo", label: "Site photo" },
  { value: "permit", label: "Permit" },
  { value: "reference", label: "Reference" },
  { value: "other", label: "Other" },
];

export function FilingUploadForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File, kind: ProjectFileKind, title: string) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    fd.append("title", title);
    const res = await fetch(`/api/projects/${projectId}/files`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Upload failed (${res.status})`);
    }
  }

  return (
    <form
      className={s.card}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fileInput = form.elements.namedItem("file") as HTMLInputElement;
        const file = fileInput.files?.[0];
        if (!file) {
          toast.show("Choose a file first", "error");
          return;
        }
        const kind = (form.elements.namedItem("kind") as HTMLSelectElement)
          .value as ProjectFileKind;
        const title =
          (form.elements.namedItem("title") as HTMLInputElement).value.trim() ||
          file.name;
        setBusy(true);
        try {
          await upload(file, kind, title);
          toast.show("Uploaded", "success");
          form.reset();
          router.refresh();
        } catch (err) {
          toast.show(
            err instanceof Error ? err.message : "Upload failed",
            "error",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className={s.cardTitle}>Upload</h2>
      <p className={s.brandSub}>
        JPEG, PNG, WEBP, or PDF. Images appear in the swipe gallery; quote
        emails stay plain text only.
      </p>

      <label className={s.label}>
        File
        <input
          ref={inputRef}
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          required
          className={s.input}
        />
      </label>

      <label className={s.label}>
        Title
        <input name="title" className={s.input} placeholder="e.g. Rear plan" />
      </label>

      <label className={s.label}>
        Kind
        <select name="kind" className={s.input} defaultValue="plan">
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" className={s.btn} disabled={busy}>
        {busy ? "Uploading…" : "Upload to filing"}
      </button>
    </form>
  );
}
