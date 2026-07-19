"use client";

import { useEffect, useState } from "react";
import css from "./canvasCoachMarks.module.css";

const STORAGE_KEY = "ws_coach_done";

const STEPS = [
  {
    title: "Trace the lot",
    body: "Lock the Vicmap title, then open Fit sheet to draft boundary and footprint in ink.",
    placement: "bottomLeft" as const,
  },
  {
    title: "Add planting & hardscape",
    body: "Sketch or CAD mode — place symbols, review AI ghosts before accept.",
    placement: "topRight" as const,
  },
  {
    title: "Fit sheet & quote",
    body: "Toggle Fit sheet for the working drawing, then promote to Quote when CAD is verified.",
    placement: "bottomLeft" as const,
  },
];

type Props = {
  force?: boolean;
};

export function CanvasCoachMarks({ force = false }: Props) {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (force) {
      setStep(0);
      return;
    }
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setStep(0);
  }, [force]);

  if (step == null || step >= STEPS.length) return null;

  const current = STEPS[step]!;
  const placement =
    current.placement === "topRight" ? css.markTopRight : css.markBottomLeft;

  const finish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setStep(null);
  };

  return (
    <div
      className={`${css.mark} ${placement}`}
      data-testid="canvas-coach-mark"
      role="dialog"
      aria-label="Onboarding"
    >
      <p className={css.title}>
        {step + 1}. {current.title}
      </p>
      <p className={css.body}>{current.body}</p>
      <div className={css.actions}>
        <button
          type="button"
          className={`${css.btn} ${css.btnPrimary}`}
          onClick={() => {
            if (step + 1 >= STEPS.length) finish();
            else setStep(step + 1);
          }}
        >
          {step + 1 >= STEPS.length ? "Done" : "Next"}
        </button>
        <button type="button" className={`${css.btn} ${css.btnGhost}`} onClick={finish}>
          Skip
        </button>
      </div>
    </div>
  );
}
