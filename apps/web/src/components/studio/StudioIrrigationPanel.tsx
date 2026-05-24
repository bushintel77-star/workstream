"use client";

import { useMemo, useState } from "react";
import {
  summarizeIrrigationZone,
  summarizeIrrigationZones,
  type CanvasGroundScale,
} from "@workstream/domain";
import type { IrrigationZone } from "@workstream/contracts";
import s from "./studioPanel.module.css";

type Props = {
  zones: IrrigationZone[];
  selectedZoneId: string | null;
  isDrawing: boolean;
  scale: CanvasGroundScale;
  onSelectZone: (id: string) => void;
  onUpdateZone: (id: string, patch: Partial<IrrigationZone>) => void;
  onDeleteZone: (id: string) => void;
  onStartNewZone: () => void;
  onFinishLine: () => void;
};

export function StudioIrrigationPanel({
  zones,
  selectedZoneId,
  isDrawing,
  scale,
  onSelectZone,
  onUpdateZone,
  onDeleteZone,
  onStartNewZone,
  onFinishLine,
}: Props) {
  const [showSummary, setShowSummary] = useState(false);
  const selected = zones.find((z) => z.id === selectedZoneId) ?? null;

  const zoneStats = useMemo(() => {
    if (!selected) return null;
    return summarizeIrrigationZone(selected, scale);
  }, [selected, scale]);

  const summary = useMemo(
    () => summarizeIrrigationZones(zones, scale),
    [zones, scale],
  );

  return (
    <div className={`${s.panel} ${s.panelRail}`} data-testid="studio-irrigation-panel">
      <h3 className={s.panelTitle}>Irrigation</h3>
      <div className={s.actions}>
        <button type="button" className={s.btn} onClick={onStartNewZone}>
          New zone
        </button>
        <button
          type="button"
          className={s.btn}
          disabled={!selectedZoneId}
          onClick={() => selectedZoneId && onDeleteZone(selectedZoneId)}
        >
          Delete zone
        </button>
        <button type="button" className={s.btn} onClick={() => setShowSummary(true)}>
          Summary
        </button>
      </div>

      {isDrawing ? (
        <>
          <p className={s.panelHint}>Tap aerial to trace drip line. Finish when done.</p>
          <button type="button" className={s.btn} onClick={onFinishLine}>
            Finish line
          </button>
        </>
      ) : null}

      {selected && zoneStats ? (
        <div className={s.row}>
          <label className={s.label}>
            Zone name
            <input
              type="text"
              className={`${s.input} ${s.inputWide}`}
              value={selected.name}
              onChange={(e) => onUpdateZone(selected.id, { name: e.target.value })}
            />
          </label>
          <label className={s.label}>
            Spacing (cm)
            <input
              type="number"
              className={s.input}
              min={10}
              step={5}
              value={selected.emitter_spacing_cm}
              onChange={(e) =>
                onUpdateZone(selected.id, {
                  emitter_spacing_cm: Number(e.target.value) || 30,
                })
              }
            />
          </label>
          <label className={s.label}>
            Flow (L/h)
            <input
              type="number"
              className={s.input}
              min={0.5}
              step={0.1}
              value={selected.emitter_flow_lph}
              onChange={(e) =>
                onUpdateZone(selected.id, {
                  emitter_flow_lph: Number(e.target.value) || 2,
                })
              }
            />
          </label>
          <div className={s.metricGrid}>
            <div className={s.metricCard}>
              <span className={s.metricCardLabel}>Pipe length</span>
              <span className={s.metricCardValue}>{zoneStats.lengthM.toFixed(1)}</span>
              <span className={s.metricCardUnit}>metres</span>
            </div>
            <div className={s.metricCard}>
              <span className={s.metricCardLabel}>Emitters</span>
              <span className={s.metricCardValue}>{zoneStats.emitters}</span>
              <span className={s.metricCardUnit}>{zoneStats.flowLph.toFixed(1)} L/h total</span>
            </div>
          </div>
          <span className={s.hint}>Hydraulic design by irrigation contractor</span>
        </div>
      ) : null}

      <div className={s.zoneList}>
        {zones.map((zone) => (
          <button
            key={zone.id}
            type="button"
            className={`${s.zoneItem} ${zone.id === selectedZoneId ? s.zoneItemSelected : ""}`}
            onClick={() => onSelectZone(zone.id)}
          >
            {zone.name}
          </button>
        ))}
      </div>

      {showSummary ? (
        <div
          className={s.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="irrigation-summary-title"
          onClick={() => setShowSummary(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowSummary(false);
          }}
        >
          <div
            className={s.modal}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h4 id="irrigation-summary-title" className={s.modalTitle}>
              Irrigation summary
            </h4>
            {zones.length === 0 ? (
              <p>No irrigation zones defined.</p>
            ) : (
              <>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>Length (m)</th>
                      <th>Emitters</th>
                      <th>Flow (L/h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.zones.map((z) => (
                      <tr key={z.zoneId}>
                        <td>{z.name}</td>
                        <td>{z.lengthM.toFixed(2)}</td>
                        <td>{z.emitters}</td>
                        <td>{z.flowLph.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td>
                        <strong>Total</strong>
                      </td>
                      <td>{summary.totalLengthM.toFixed(2)}</td>
                      <td>{summary.totalEmitters}</td>
                      <td>{summary.totalFlowLph.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
                <p className={s.panelHint}>
                  Valves needed: {summary.valveCount} (rule of thumb: 1000 L/h per valve)
                </p>
              </>
            )}
            <button
              type="button"
              className={`${s.btn} ${s.modalClose}`}
              onClick={() => setShowSummary(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
