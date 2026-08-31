"use client";

/**
 * AI Automated Site Setup — the "Magic Setup" ingestion modal (Phase 7).
 *
 * A frosted-glass overlay that floats in the center of the WebGL studio. The
 * operator drops a survey PDF (+ optional title), the screen transitions
 * through the AI processing state machine, and the studio auto-populates with
 * a topographic canvas stack + legal setback lines.
 *
 * State machine (aiProcessingState in studioStore):
 *   IDLE → ANALYZING_SURVEY → GENERATING_SITE → SUCCESS → IDLE
 *
 * The modal self-closes on SUCCESS. The "MAGIC SETUP" button in FloatingChrome
 * opens it.
 */

import { useCallback, useRef, useState } from "react";
import { useStudioStore } from "./studioStore";
import styles from "./SiteSetupModal.module.css";

export function SiteSetupModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const aiProcessingState = useStudioStore((s) => s.aiProcessingState);
  const processSiteDocuments = useStudioStore((s) => s.processSiteDocuments);

  const [surveyFile, setSurveyFile] = useState<File | null>(null);
  const [titleFile, setTitleFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isProcessing =
    aiProcessingState === "ANALYZING_SURVEY" ||
    aiProcessingState === "GENERATING_SITE";

  const handleSubmit = useCallback(async () => {
    if (!surveyFile) return;
    await processSiteDocuments(surveyFile ?? undefined, titleFile ?? undefined);
  }, [surveyFile, titleFile, processSiteDocuments]);

  // Close on success — the store auto-resets to IDLE after 1.5s.
  if (aiProcessingState === "SUCCESS") {
    setTimeout(onClose, 0);
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) setSurveyFile(file);
    },
    [],
  );

  const statusLabel = (() => {
    switch (aiProcessingState) {
      case "ANALYZING_SURVEY":
        return "AI Vision parsing contours...";
      case "GENERATING_SITE":
        return "Generating 3D topographic stack...";
      case "SUCCESS":
        return "Site setup complete";
      default:
        return null;
    }
  })();

  return (
    <div className={styles.backdrop} onClick={isProcessing ? undefined : onClose}>
      <div
        className={styles.modal}
        data-ai-state={aiProcessingState}
        onClick={(e) => e.stopPropagation()}
      >
        {!isProcessing && aiProcessingState !== "SUCCESS" && (
          <>
            <div className={styles.header}>
              <span className={styles.title}>Magic setup</span>
              <button
                className={styles.closeBtn}
                onClick={onClose}
                title="Close"
              >
                &times;
              </button>
            </div>

            <div className={styles.body}>
              <div
                className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ""} ${surveyFile ? styles.dropzoneFilled : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className={styles.fileInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSurveyFile(file);
                  }}
                />
                {surveyFile ? (
                  <div className={styles.fileInfo}>
                    <span className={styles.fileIcon}>PDF</span>
                    <span className={styles.fileName}>{surveyFile.name}</span>
                  </div>
                ) : (
                  <div className={styles.dropzonePrompt}>
                    <span className={styles.dropzoneIcon}>+</span>
                    <span>Upload PDF survey</span>
                    <span className={styles.dropzoneHint}>
                      Drop a file or click to browse
                    </span>
                  </div>
                )}
              </div>

              <div
                className={`${styles.dropzoneSecondary} ${titleFile ? styles.dropzoneFilled : ""}`}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".pdf,application/pdf";
                  input.onchange = () => {
                    const file = input.files?.[0];
                    if (file) setTitleFile(file);
                  };
                  input.click();
                }}
              >
                {titleFile ? (
                  <span className={styles.fileName}>{titleFile.name}</span>
                ) : (
                  <span className={styles.optional}>+ Title document (optional)</span>
                )}
              </div>

              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={!surveyFile}
                title={surveyFile ? "Run AI site setup" : "Upload a survey first"}
              >
                Run AI setup
              </button>
            </div>
          </>
        )}

        {isProcessing && (
          <div className={styles.processing}>
            <div className={styles.spinner} />
            <div className={styles.processingLabel}>{statusLabel}</div>
            <div className={styles.processingHint}>
              Analyzing survey geometry, extracting contours, and generating
              the 3D site model.
            </div>
          </div>
        )}

        {aiProcessingState === "SUCCESS" && (
          <div className={styles.success}>
            <div className={styles.successCheck}>&#10003;</div>
            <div className={styles.processingLabel}>{statusLabel}</div>
          </div>
        )}
      </div>
    </div>
  );
}
