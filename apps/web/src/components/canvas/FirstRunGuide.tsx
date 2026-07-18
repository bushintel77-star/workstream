"use client";

import { useTransition } from "react";
import { prepareSiteFirstRunAction } from "../../app/actions";
import css from "./firstRunGuide.module.css";

type CadSeed = {
  document: unknown;
  svg: string | null;
  ghost_count: number;
};

type Props = {
  projectId: string;
  onDone: (
    mode: "cad" | "sketch",
    ghostCount?: number,
    cad?: CadSeed | null,
  ) => void;
  onDismiss: () => void;
};

export function FirstRunGuide({ projectId, onDone, onDismiss }: Props) {
  const [pending, start] = useTransition();

  return (
    <div className={css.panel} data-testid="first-run-guide" role="dialog">
      <p className={css.kicker}>Two minutes</p>
      <h2 className={css.title}>Open your Fit sheet</h2>
      <p className={css.body}>
        One tap prepares a starter concept on the cream working drawing with a
        live estimate. Nudge anything after — nothing is locked in.
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
              onDone(res.mode, res.ghostCount, res.cad);
            })
          }
        >
          {pending ? "Preparing Fit sheet…" : "Prepare Fit sheet"}
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
