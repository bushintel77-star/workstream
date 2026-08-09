"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectOrchestrationWorld } from "@workstream/contracts";
import {
  proposeShadowAlternatives,
  type ShadowAlternative,
  type ShadowLedgerIntensity,
} from "@workstream/domain";
import { CameraChrome } from "../../CameraChrome";
import css from "./nextBestOptionChip.module.css";

const PREF_KEY = "ws-shadow-ledger-intensity";

type Props = {
  world: ProjectOrchestrationWorld | null;
  paper?: boolean;
  onApply?: (alt: ShadowAlternative) => void;
};

function readIntensity(): ShadowLedgerIntensity {
  if (typeof window === "undefined") return "subtle";
  const v = window.localStorage.getItem(PREF_KEY);
  if (v === "off" || v === "subtle" || v === "prominent") return v;
  return "subtle";
}

export function NextBestOptionChip({ world, paper = false, onApply }: Props) {
  const [intensity, setIntensity] = useState<ShadowLedgerIntensity>("subtle");
  const [open, setOpen] = useState(false);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    setIntensity(readIntensity());
  }, []);

  const alts = useMemo(() => {
    if (!world) return [] as ShadowAlternative[];
    return proposeShadowAlternatives(world);
  }, [world]);

  const top = alts.find((a) => a.id !== dismissedId) ?? null;

  if (intensity === "off" || !top) return null;

  const persistIntensity = (next: ShadowLedgerIntensity) => {
    setIntensity(next);
    window.localStorage.setItem(PREF_KEY, next);
  };

  // Portal only when the chip has content — never park an empty chrome shell.
  return (
    <CameraChrome
      place={{ kind: "dock" }}
      zIndex={36}
      testId="next-best-option-chrome"
    >
      <div
        className={`${css.wrap}${paper ? ` ${css.paper}` : ""}${
          intensity === "prominent" ? ` ${css.prominent}` : ""
        }`}
        data-testid="next-best-option-chip"
      >
        <button
          type="button"
          className={css.chip}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {top.label}
        </button>
        {open ? (
          <div className={css.panel} data-testid="next-best-option-panel">
            <p className={css.detail}>{top.detail}</p>
            {top.apply_hint ? (
              <p className={css.hint}>{top.apply_hint}</p>
            ) : null}
            <div className={css.actions}>
              <button
                type="button"
                className={`${css.btn} ${css.btnPrimary}`}
                onClick={() => {
                  onApply?.(top);
                  setOpen(false);
                  setDismissedId(top.id);
                }}
              >
                Apply
              </button>
              <button
                type="button"
                className={css.btn}
                onClick={() => {
                  setDismissedId(top.id);
                  setOpen(false);
                }}
              >
                Keep current
              </button>
            </div>
            <div className={css.prefs}>
              <button
                type="button"
                className={css.prefBtn}
                onClick={() => persistIntensity("subtle")}
              >
                Subtle
              </button>
              <button
                type="button"
                className={css.prefBtn}
                onClick={() => persistIntensity("prominent")}
              >
                Prominent
              </button>
              <button
                type="button"
                className={css.prefBtn}
                onClick={() => persistIntensity("off")}
              >
                Mute
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </CameraChrome>
  );
}
