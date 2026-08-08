"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import type { DesignBranchSnapshot } from "@workstream/contracts";
import {
  activateDesignBranchAction,
  freezeDesignBranchAction,
  listDesignBranchesAction,
} from "../../app/actions";
import css from "./designBranchStrip.module.css";

type Props = {
  projectId: string;
  bomTotal?: number;
  labourHours?: number;
  canvasFingerprint?: string;
  paper?: boolean;
  /** Imperative freeze trigger from Instant Planner. */
  freezeNonce?: number;
};

export function DesignBranchStrip({
  projectId,
  bomTotal = 0,
  labourHours = 0,
  canvasFingerprint = "",
  paper = false,
  freezeNonce = 0,
}: Props) {
  const [branches, setBranches] = useState<DesignBranchSnapshot[]>([]);
  const [pending, startTransition] = useTransition();
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState("");

  const reload = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await listDesignBranchesAction(projectId);
        setBranches(res.branches);
      } catch {
        setBranches([]);
      }
    });
  }, [projectId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (freezeNonce > 0) setNameOpen(true);
  }, [freezeNonce]);

  const freeze = () => {
    const label =
      name.trim() ||
      `Client preferred – ${new Date().toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
      })}`;
    startTransition(async () => {
      const res = await freezeDesignBranchAction(projectId, {
        name: label,
        bom_total: bomTotal,
        labour_hours: labourHours,
        canvas_fingerprint: canvasFingerprint,
        thumbnail_note: `${branches.length + 1} · frozen`,
      });
      setBranches(res.branches);
      setNameOpen(false);
      setName("");
    });
  };

  return (
    <div
      className={`${css.strip}${paper ? ` ${css.paper}` : ""}`}
      data-testid="design-branch-strip"
    >
      <div className={css.row}>
        <p className={css.kicker}>Variations</p>
        <button
          type="button"
          className={css.btn}
          data-testid="branch-freeze-open"
          disabled={pending}
          onClick={() => setNameOpen((v) => !v)}
        >
          Freeze
        </button>
      </div>
      {nameOpen ? (
        <div className={css.nameRow}>
          <input
            className={css.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Client preferred – 9 Aug"
            aria-label="Branch name"
            data-testid="branch-name-input"
          />
          <button
            type="button"
            className={`${css.btn} ${css.btnPrimary}`}
            disabled={pending}
            data-testid="branch-freeze-confirm"
            onClick={freeze}
          >
            Save
          </button>
        </div>
      ) : null}
      {branches.length > 0 ? (
        <ul className={css.thumbs}>
          {branches.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                className={`${css.thumb}${b.active ? ` ${css.thumbActive}` : ""}`}
                disabled={pending}
                title={b.name}
                onClick={() =>
                  startTransition(async () => {
                    const res = await activateDesignBranchAction(
                      projectId,
                      b.id,
                    );
                    setBranches(res.branches);
                  })
                }
              >
                <span className={css.thumbName}>{b.name}</span>
                <span className={css.thumbMeta}>
                  {new Intl.NumberFormat("en-AU", {
                    style: "currency",
                    currency: "AUD",
                    maximumFractionDigits: 0,
                  }).format(b.bom_total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={css.empty}>Freeze a state to branch variations.</p>
      )}
    </div>
  );
}
