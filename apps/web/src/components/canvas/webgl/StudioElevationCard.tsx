"use client";

/**
 * Gold Standard 2026 — Studio Elevation Card (native WebGL elevation mode).
 *
 * Mounts the classic ElevationBoard (props-driven, zero state coupling —
 * GOLD-STANDARD-2026-ARCHITECTURE §5: "feature modules become consumers of
 * the new shell") as a floating glass sheet over the WebGL studio. The N/E/S/W
 * looks reuse the domain projector (`elevationLookProjector`) and label
 * layout; `dark` joins it to Studio Dark.
 */

import { useState } from "react";
import type { ElevationLook } from "@workstream/domain";
import { GlassCard } from "./GlassCard";
import { ElevationBoard } from "../handoff/features/elevation/ElevationBoard";
import type { StudioItem } from "../handoff/studioCatalog";
import type { PctPoint } from "./coordTransform";

const LOOKS: ElevationLook[] = ["N", "E", "S", "W"];

const chipStyle = (active: boolean): React.CSSProperties => ({
  fontFamily: "var(--font-ui)",
  fontSize: 10.5,
  letterSpacing: "0.06em",
  padding: "3px 10px",
  borderRadius: "var(--gs-radius-pill)",
  border: `1px solid ${
    active
      ? "color-mix(in srgb, var(--gs-primary) 45%, transparent)"
      : "color-mix(in srgb, var(--gs-line) 55%, transparent)"
  }`,
  background: active
    ? "color-mix(in srgb, var(--gs-primary) 16%, transparent)"
    : "transparent",
  color: active ? "var(--gs-primary)" : "var(--gs-ink-secondary)",
  cursor: "pointer",
});

export function StudioElevationCard({
  boundaryPct,
  buildingPct,
  items,
  scaleM,
  onTraceInPlan,
  onClose,
}: {
  boundaryPct: PctPoint[];
  buildingPct?: PctPoint[];
  items: StudioItem[];
  scaleM: number;
  /** Trace an elevation profile back onto the plan (sketch surface). */
  onTraceInPlan: (id: string) => void;
  onClose: () => void;
}) {
  const [look, setLook] = useState<ElevationLook>("S");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <GlassCard
      position={{
        position: "absolute",
        bottom: 92,
        left: "50%",
        transform: "translateX(-50%)",
      }}
      style={{ width: "min(860px, 92vw)", padding: "10px 12px" }}
    >
      <div
        data-testid="studio-elevation-card"
        style={{ fontFamily: "var(--font-ui)", color: "var(--gs-ink)" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--gs-ink-secondary)",
            }}
          >
            Elevation · {look}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {LOOKS.map((l) => (
              <button
                key={l}
                type="button"
                data-testid={`elevation-look-${l}`}
                aria-label={`Elevation look ${l}`}
                style={chipStyle(l === look)}
                onClick={() => setLook(l)}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close elevation"
            data-testid="elevation-close"
            style={{
              ...chipStyle(false),
              marginLeft: "auto",
            }}
          >
            Close
          </button>
        </div>
        {boundaryPct.length >= 3 ? (
          <ElevationBoard
            look={look}
            boundary={boundaryPct}
            building={buildingPct ?? []}
            items={items}
            selectedId={selectedId}
            scaleM={scaleM}
            dark
            onSelect={setSelectedId}
            onCycleLook={() =>
              setLook(LOOKS[(LOOKS.indexOf(look) + 1) % LOOKS.length])
            }
            onTraceInPlan={onTraceInPlan}
          />
        ) : (
          <p
            style={{
              fontSize: 12,
              color: "var(--gs-ink-secondary)",
              padding: "24px 8px",
              textAlign: "center",
            }}
          >
            Run the survey to trace the title boundary — elevations project
            the parcel, so nothing is invented without it.
          </p>
        )}
      </div>
    </GlassCard>
  );
}
