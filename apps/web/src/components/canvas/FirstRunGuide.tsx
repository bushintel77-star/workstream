"use client";

import { useTransition } from "react";
import { prepareSiteFirstRunAction } from "../../app/actions";
import css from "./firstRunGuide.module.css";

type Props = {
  projectId: string;
  onDone: (mode: "cad" | "sketch") => void;
  onDismiss: () => void;
};

export function FirstRunGuide({ projectId, onDone, onDismiss }: Props) {
  const [pending, start] = useTransition();

  return (
    <div className={css.panel} data-testid="first-run-guide" role="dialog">
      <p className={css.kicker}>Two minutes</p>
      <h2 className={css.title}>Your site is ready</h2>
      <p className={css.body}>
        One tap prepares a starter concept, working drawing, and live estimate.
        You can nudge anything after - nothing is locked in.
      </p>
      <div className={css.actions}>
        <button
          type="button"
          className={css.primary}
          disabled={pending}
          data-testid="first-run-prepare"
          onClick={() =>
            start(async () => {
              const res = await prepareSiteFirstRunAction(projectId);
              onDone(res.mode);
            })
          }
        >
          {pending ? "Preparing site..." : "Prepare this site"}
        </button>
        <button
          type="button"
          className={css.ghost}
          disabled={pending}
          onClick={onDismiss}
        >
          I&apos;ll sketch myself
        </button>
      </div>
    </div>
  );
}
