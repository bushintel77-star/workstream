"use client";

/**
 * AI Prompt Bar — the primary input for the AI-driven native canvas.
 *
 * A floating frosted-glass input at the bottom center of the canvas.
 * The operator types a natural language instruction ("native screening
 * along the west boundary") and the AI generates ghost placements on the
 * canvas. Accept commits them as real placements.
 *
 * States:
 *   idle     → empty input, placeholder "Describe your landscape…"
 *   thinking → spinner + the prompt echoed
 *   ready    → ghost count + Accept / Regenerate / Cancel buttons
 *   accepted → brief confirmation flash, then resets to idle
 */

import { useState, type KeyboardEvent } from "react";
import { useStudioStore } from "./studioStore";
import { Button } from "./Button";

export function AiPromptBar({
  onGenerate,
}: {
  /** Called with the prompt; parent runs the generation engine. */
  onGenerate: (prompt: string) => void;
}) {
  const aiSession = useStudioStore((s) => s.aiSession);
  const acceptAiGhosts = useStudioStore((s) => s.acceptAiGhosts);
  const clearAiSession = useStudioStore((s) => s.clearAiSession);
  const [value, setValue] = useState("");

  const status = aiSession.status;
  const isBusy = status === "thinking";
  const isReady = status === "ready" && aiSession.ghosts.length > 0;

  const submit = () => {
    const prompt = value.trim();
    if (!prompt || isBusy) return;
    onGenerate(prompt);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") {
      clearAiSession();
      setValue("");
    }
  };

  return (
    <>
    <div
      data-testid="ai-prompt-bar"
      style={{
        position: "absolute",
        bottom: 20,
        /* Own column between the tool rail (72px) and the estimator float
         * (right gutter 336 + 340 wide + air) — centered on that band via
         * auto margins. Centering on the full viewport put it under the
         * estimator at narrow widths (chrome-collision: the pill's clicks
         * landed on this bar). */
        left: 72,
        right: 692,
        margin: "0 auto",
        width: "max-content",
        display: "flex",
        alignItems: "center",
        gap: "var(--gs-space-2)",
        padding: "6px 12px",
        borderRadius: "var(--gs-radius-pill)",
        background: "color-mix(in srgb, var(--la-surface) 85%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid var(--la-surface-muted)",
        pointerEvents: "auto",
        zIndex: "var(--cf-z-chrome)",
        maxWidth: "min(560px, calc(100% - 12px))",
        boxShadow: "var(--gs-shadow-2)",
      }}
    >
      {/* Status icon */}
      <span
        aria-hidden
        style={{
          fontSize: "var(--gs-font-lg)",
          color: "var(--la-accent)",
          opacity: isBusy ? 0.5 : 1,
          animation: isBusy ? "wsPulse 1.2s ease-in-out infinite" : undefined,
        }}
      >
        {isBusy ? "◈" : isReady ? "✓" : "✦"}
      </span>

      {/* Input / status text */}
      {isReady ? (
        <span
          data-testid="ai-prompt-result"
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: "var(--gs-font-sm)",
            color: "var(--la-ink)",
            flex: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {aiSession.ghosts.length} generated — "{aiSession.prompt.slice(0, 40)}"
        </span>
      ) : (
        <input
          /* No autofocus: a forced ref-focus here stole focus after mode
           * switches and re-mounts, which put the studio's keyboard
           * contract (Esc clears selection, arrows drive the camera) into
           * its "typing" guard with no operator intent. The bar is a
           * naturally-tabbable bottom input — click or Tab reaches it. */
          type="text"
          value={isBusy ? aiSession.prompt : value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            isBusy
              ? "Generating…"
              : "Describe your landscape — e.g. native screening along the boundary"
          }
          aria-label="AI landscape prompt"
          data-testid="ai-prompt-input"
          disabled={isBusy}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--la-ink)",
            fontFamily: "var(--font-ui)",
            fontSize: "var(--gs-font-sm)",
            "::placeholder": { color: "var(--la-ink-muted)" },
          } as React.CSSProperties}
        />
      )}

      {/* Actions */}
      {isReady ? (
        <>
          <Button
            variant="chip"
            active
            data-testid="ai-prompt-accept"
            onClick={() => {
              acceptAiGhosts();
              setValue("");
            }}
          >
            ✓ Accept
          </Button>
          <Button
            variant="chip"
            data-testid="ai-prompt-regenerate"
            onClick={() => onGenerate(aiSession.prompt)}
          >
            ↻ Regenerate
          </Button>
          <Button
            variant="chip"
            data-testid="ai-prompt-cancel"
            onClick={() => {
              clearAiSession();
              setValue("");
            }}
          >
            ✕
          </Button>
        </>
      ) : (
        <Button
          variant="chip"
          data-testid="ai-prompt-submit"
          onClick={submit}
          disabled={!value.trim() || isBusy}
        >
          {isBusy ? "…" : "→"}
        </Button>
      )}
    </div>
    {/* Keyframes — injected once (SaveStatusChip pattern). */}
    <style>{`
      @keyframes wsPulse {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 1; }
      }
    `}</style>
    </>
  );
}
