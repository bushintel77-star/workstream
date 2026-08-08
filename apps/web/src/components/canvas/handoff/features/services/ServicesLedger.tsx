"use client";

import { useMemo } from "react";
import type {
  ConstructionTrench,
  DesignBydaAsset,
  IrrigationZone,
} from "@workstream/contracts";
import type { SpotLevel, StudioItem } from "../../studioCatalog";
import type { PctPoint } from "../../geometry";
import {
  buildServiceLedgerRows,
  type ServiceLedgerRow,
} from "./serviceLedger";
import {
  BYDA_PACK,
  CHASE_PACK,
  KEYLESS_NEXT,
} from "./dueDiligenceCatalog";
import { MetaIcon } from "../stickyMeta/MetaIcon";
import metaCss from "../stickyMeta/metaPanel.module.css";
import css from "./servicesLedger.module.css";

type Props = {
  open: boolean;
  locked: boolean;
  scaleM: number;
  services: PctPoint[][];
  easements: PctPoint[][];
  bydaAssets?: DesignBydaAsset[];
  levels: SpotLevel[];
  irrigationZones: IrrigationZone[];
  constructionTrenches: ConstructionTrench[];
  items: StudioItem[];
  /** id → true means hidden. */
  hiddenIds: Record<string, boolean>;
  focusedIds: string[] | null;
  onClose: () => void;
  onToggleVisible: (id: string) => void;
  onFocus: (id: string, additive: boolean) => void;
  onClearFocus: () => void;
  onShowAll: () => void;
  onFocusChecked: () => void;
  /** Peel open trench dig / lighting schedules (branch tip). */
  onOpenSchedule?: () => void;
};

function Section({
  title,
  rows,
  locked,
  hiddenIds,
  focusedIds,
  onToggleVisible,
  onFocus,
}: {
  title: string;
  rows: ServiceLedgerRow[];
  locked: boolean;
  hiddenIds: Record<string, boolean>;
  focusedIds: string[] | null;
  onToggleVisible: (id: string) => void;
  onFocus: (id: string, additive: boolean) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className={css.section}>
      <p className={css.sectionHead}>
        <span>{title}</span>
        <span>{rows.length}</span>
      </p>
      <ul className={css.list}>
        {rows.map((row) => {
          const hidden = Boolean(hiddenIds[row.id]);
          const focused = focusedIds?.includes(row.id) ?? false;
          return (
            <li
              key={row.id}
              className={css.row}
              data-focused={focused ? "true" : "false"}
              data-hidden={hidden ? "true" : "false"}
            >
              <input
                type="checkbox"
                className={css.tick}
                data-testid={`services-ledger-tick-${row.id}`}
                checked={!hidden}
                disabled={locked}
                aria-label={`${hidden ? "Show" : "Hide"} ${row.label}`}
                onChange={() => onToggleVisible(row.id)}
              />
              <button
                type="button"
                className={css.rowBtn}
                data-testid={`services-ledger-row-${row.kind}`}
                onClick={(e) => {
                  const additive =
                    e.shiftKey || e.metaKey || e.ctrlKey;
                  onFocus(row.id, additive);
                }}
              >
                <div className={css.body}>
                  <div className={css.top}>
                    <span className={css.label}>
                      <span className={css.glyph} aria-hidden>
                        {row.glyph}
                      </span>
                      {row.label}
                    </span>
                    <span className={css.metric}>{row.metric}</span>
                  </div>
                  <span className={css.detail}>{row.detail}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Right-lane services inventory — metrics, visibility ticks, click-to-isolate.
 * Replaces the Services opacity slider as the operator surface for site utilities.
 */
export function ServicesLedger({
  open,
  locked,
  scaleM,
  services,
  easements,
  bydaAssets = [],
  levels,
  irrigationZones,
  constructionTrenches,
  items,
  hiddenIds,
  focusedIds,
  onClose,
  onToggleVisible,
  onFocus,
  onClearFocus,
  onShowAll,
  onFocusChecked,
  onOpenSchedule,
}: Props) {
  const rows = useMemo(
    () =>
      buildServiceLedgerRows({
        services,
        easements,
        bydaAssets,
        levels,
        irrigationZones,
        constructionTrenches,
        items,
        scaleM,
      }),
    [
      services,
      easements,
      bydaAssets,
      levels,
      irrigationZones,
      constructionTrenches,
      items,
      scaleM,
    ],
  );

  if (!open) return null;

  const site = rows.filter((r) => r.section === "site");
  const design = rows.filter((r) => r.section === "design");
  const hasFocus = (focusedIds?.length ?? 0) > 0;

  return (
    <div
      className={`${metaCss.panel} ${css.panel}`}
      data-testid="services-ledger"
      role="dialog"
      aria-label="Services ledger"
    >
      <div className={metaCss.head}>
        <div className={metaCss.headMain}>
          <span className={metaCss.headIcon}>
            <MetaIcon id="services" size={20} />
          </span>
          <div>
            <p className={metaCss.kicker}>Site inventory · live</p>
            <h2 className={metaCss.title}>
              Services
              {locked ? (
                <span className={css.locked} data-testid="services-ledger-locked">
                  Survey locked
                </span>
              ) : null}
            </h2>
          </div>
        </div>
        <button type="button" className={metaCss.close} onClick={onClose}>
          Close
        </button>
      </div>

      <p className={metaCss.live} data-testid="services-ledger-live">
        <span className={metaCss.metric}>{rows.length}</span>
        <span>
          mapped features · {site.length} site · {design.length} design
        </span>
      </p>

      <p className={metaCss.honesty} data-testid="services-ledger-honesty">
        Vicmap easements ≠ underground assets. Dig still needs BYDA — and often
        council drainage.
      </p>

      {rows.length === 0 ? (
        <p className={css.empty}>
          Trace with Servc · Level · Calib in Survey, or draw lighting / drip
          zones in CAD — then Auto trench for conduit dig paths.
        </p>
      ) : (
        <>
          <Section
            title="Site context"
            rows={site}
            locked={locked}
            hiddenIds={hiddenIds}
            focusedIds={focusedIds}
            onToggleVisible={onToggleVisible}
            onFocus={onFocus}
          />
          <Section
            title="Design · lighting & dig"
            rows={design}
            locked={locked}
            hiddenIds={hiddenIds}
            focusedIds={focusedIds}
            onToggleVisible={onToggleVisible}
            onFocus={onFocus}
          />
        </>
      )}

      {onOpenSchedule ? (
        <div className={css.actions}>
          <button
            type="button"
            className={css.actionBtn}
            data-testid="services-ledger-schedule"
            onClick={onOpenSchedule}
          >
            Schedule
          </button>
        </div>
      ) : null}

      <div className={css.actions}>
        <button
          type="button"
          className={css.actionBtn}
          data-testid="services-ledger-clear-focus"
          disabled={!hasFocus}
          onClick={onClearFocus}
        >
          Clear focus
        </button>
        <button
          type="button"
          className={css.actionBtn}
          data-testid="services-ledger-focus-visible"
          disabled={rows.length === 0}
          onClick={onFocusChecked}
        >
          Focus visible
        </button>
        <button
          type="button"
          className={css.actionBtn}
          data-testid="services-ledger-show-all"
          disabled={locked || Object.keys(hiddenIds).length === 0}
          onClick={onShowAll}
        >
          Show all
        </button>
      </div>

      <div className={css.due} data-testid="services-ledger-due-diligence">
        <p className={css.sectionHead}>
          <span>Full LA pack</span>
          <span>before dig</span>
        </p>
        <ul className={css.dueList}>
          {[...KEYLESS_NEXT, ...BYDA_PACK.slice(0, 4), ...CHASE_PACK.slice(0, 4)].map(
            (item) => (
              <li key={item.id} className={css.dueRow}>
                <span className={css.dueLabel}>{item.label}</span>
                <span className={css.dueStatus} data-status={item.status}>
                  {item.status}
                </span>
              </li>
            ),
          )}
        </ul>
        <p className={metaCss.foot}>
          KEYLESS = same Vicmap WFS stack as title. BYDA = membership enquiry.
          Survey 5/5 is the digital minimum — see docs/SITE-INFRASTRUCTURE-AUTOMATED-LINKS.md.
        </p>
      </div>
    </div>
  );
}
