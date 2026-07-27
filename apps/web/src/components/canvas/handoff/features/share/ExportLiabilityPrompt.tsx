"use client";

import { useState } from "react";
import type { BoardDisclaimer } from "@workstream/contracts";
import css from "./exportLiability.module.css";

type Props = {
  disclaimers: BoardDisclaimer[];
  /** Ids the operator has accepted onto this issue. */
  accepted: Record<string, boolean>;
  onToggle: (id: string, accepted: boolean) => void;
};

const KIND_LABEL: Record<BoardDisclaimer["kind"], string> = {
  maturity: "Maturity",
  design_intent: "Design intent",
  subsurface: "Subsurface",
  tpo: "Tree protection",
  safety_waiver: "Safety",
};

/** How strong the evidence behind the trigger is. */
const BASIS_LABEL: Record<BoardDisclaimer["basis"], string> = {
  vicmap: "Vicmap fact",
  operator: "your sketch",
  derived: "estimate",
  seed: "demo geometry",
  absent: "no data",
};

/**
 * Export liability overlay — the notices this drawing's own content implies.
 *
 * Duty-of-care automation, not a checkbox ritual: each notice names what on the
 * board triggered it, so a drawing with no trench never asks about subsurface
 * conditions. Required notices are the ones with direct evidence behind them —
 * a pool with no barrier drawn, a measured trunk inside the works.
 *
 * It prompts and it records the operator's decision. It does not block the
 * share and it does not write wording onto the set: what goes to a client is
 * the practice's call, and a tool that decides that for them is worse than one
 * that stays quiet.
 */
export function ExportLiabilityPrompt({
  disclaimers,
  accepted,
  onToggle,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (disclaimers.length === 0) return null;

  const required = disclaimers.filter((d) => d.required);
  const unanswered = required.filter((d) => !accepted[d.id]).length;

  return (
    <section className={css.root} data-testid="export-liability-prompt">
      <div className={css.head}>
        <p className={css.kicker}>Before you issue</p>
        <span
          className={css.countPill}
          data-outstanding={unanswered > 0 ? "true" : "false"}
        >
          {unanswered > 0 ? `${unanswered} outstanding` : "All acknowledged"}
        </span>
      </div>
      <p className={css.lead}>
        {required.length > 0
          ? "This drawing's content calls for these notices on the issued set."
          : "Nothing here is mandatory — these are worth considering for this set."}
      </p>

      <ul className={css.list}>
        {disclaimers.map((d) => {
          const open = openId === d.id;
          return (
            <li key={d.id} className={css.item} data-required={d.required}>
              <label className={css.row}>
                <input
                  type="checkbox"
                  className={css.check}
                  checked={accepted[d.id] === true}
                  onChange={(e) => onToggle(d.id, e.target.checked)}
                  data-testid={`liability-${d.kind}`}
                />
                <span className={css.rowText}>
                  <span className={css.title}>
                    {d.title}
                    {d.required ? (
                      <span className={css.requiredTag}>Required</span>
                    ) : null}
                  </span>
                  <span className={css.trigger}>
                    {KIND_LABEL[d.kind]} · {d.trigger}
                    {" · "}
                    <span className={css.basis} data-basis={d.basis}>
                      {BASIS_LABEL[d.basis]}
                    </span>
                  </span>
                </span>
              </label>
              <button
                type="button"
                className={css.reveal}
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : d.id)}
              >
                {open ? "Hide wording" : "Read wording"}
              </button>
              {open ? (
                <p className={css.statement} data-testid={`liability-text-${d.kind}`}>
                  {d.statement}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className={css.footnote}>
        Drafting starting points reflecting ordinary practice, not legal advice.
        Your engagement terms govern.
      </p>
    </section>
  );
}
