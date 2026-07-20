"use client";

import { useEffect, useState } from "react";
import css from "./coach.module.css";

const STORAGE_KEY = "cc_coach_done";

const STEPS = [
  {
    title: "Trace the lot",
    body: "Use Trace to click boundary and building footprint over the aerial. Tab autocompletes a rectangle.",
    placement: "bottomLeft" as const,
  },
  {
    title: "Add planting & hardscape",
    body: "Arm Add, place symbols, then review AI ghosts before accept. Stale ghosts pulse amber after nearby edits.",
    placement: "topRight" as const,
  },
  {
    title: "Fit sheet & quote",
    body: "Toggle Fit sheet for the working drawing (A3/A4, + Elevations), then open Quote for the live BOM.",
    placement: "bottomLeft" as const,
  },
];

type Props = {
  force?: boolean;
};

export function StudioCoachMarks({ force = false }: Props) {
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
    current.placement === "topRight" ? css.topRight : css.bottomLeft;

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
          className={css.primary}
          onClick={() => {
            if (step + 1 >= STEPS.length) finish();
            else setStep(step + 1);
          }}
        >
          {step + 1 >= STEPS.length ? "Done" : "Next"}
        </button>
        <button type="button" className={css.ghost} onClick={finish}>
          Skip
        </button>
      </div>
    </div>
  );
}
