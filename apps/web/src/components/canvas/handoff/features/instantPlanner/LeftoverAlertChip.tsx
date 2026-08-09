"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type {
  LeftoverStock,
  ProjectOrchestrationWorld,
} from "@workstream/contracts";
import { matchLeftoversToBom } from "@workstream/domain";
import { listLeftoversAction } from "../../../../../app/actions";
import { CameraChrome } from "../../CameraChrome";
import css from "./leftoverAlertChip.module.css";

type Props = {
  world: ProjectOrchestrationWorld | null;
  paper?: boolean;
  /** Open Instant Planner assist so leftovers can be acted on. */
  onOpenAssist?: () => void;
};

/**
 * Quiet peripheral leftover alert (PDF §4.6) — shows when workspace stock
 * matches the live BOM without forcing the assist panel open.
 */
export function LeftoverAlertChip({
  world,
  paper = false,
  onOpenAssist,
}: Props) {
  const [pool, setPool] = useState<LeftoverStock[]>([]);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!world) return;
    let cancelled = false;
    startTransition(async () => {
      try {
        const res = await listLeftoversAction();
        if (!cancelled) setPool(res.leftovers);
      } catch {
        if (!cancelled) setPool([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [world]);

  const match = useMemo(
    () => matchLeftoversToBom(pool, world?.live_bom ?? []),
    [pool, world?.live_bom],
  );

  if (dismissed || !match) return null;

  const chipLabel = `Leftover ${match.cover_qty} ${match.leftover.unit} ${match.leftover.label}`;

  // Portal only when a match exists — empty shells fail §6 idle geometry.
  return (
    <CameraChrome
      place={{ kind: "dock" }}
      zIndex={36}
      testId="leftover-alert-chrome"
    >
      <div
        className={`${css.wrap}${paper ? ` ${css.paper}` : ""}`}
        data-testid="leftover-alert-chip"
      >
        <button
          type="button"
          className={css.chip}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {chipLabel}
        </button>
        {open ? (
          <div className={css.panel} data-testid="leftover-alert-panel">
            <p className={css.detail}>
              {match.cover_qty} {match.leftover.unit} available from another job —
              covers part of {match.bom_line.label}. Quiet pool match only; you
              decide whether to use it.
            </p>
            <div className={css.actions}>
              {onOpenAssist ? (
                <button
                  type="button"
                  className={`${css.btn} ${css.btnPrimary}`}
                  data-testid="leftover-alert-open-assist"
                  onClick={() => {
                    onOpenAssist();
                    setOpen(false);
                  }}
                >
                  Open assist
                </button>
              ) : null}
              <button
                type="button"
                className={css.btn}
                onClick={() => {
                  setDismissed(true);
                  setOpen(false);
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </CameraChrome>
  );
}
