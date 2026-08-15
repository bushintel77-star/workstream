"use client";

import { useEffect, useState } from "react";
import type { SiteContext, TitlePlanningBadge } from "../lib/api";

const SEVERITY_COLOR: Record<TitlePlanningBadge["severity"], string> = {
  likely: "var(--gs-conflict-soft)",
  review: "var(--gs-warning)",
  clear: "var(--gs-success)",
};

/**
 * Council planning context — the GET /site-context surface as a self-fetching
 * chip set: planning badges (VPO / heritage / stormwater by council) plus the
 * season + daylight line. Severity carries the Gold Standard signal colours
 * (likely = Strike red, review = warning amber, clear = pass green).
 *
 * Renders nothing until the fetch resolves, so the `glass` variant never shows
 * an empty card. Use `bare` inside an existing panel block, `glass` as a
 * standalone canvas chip-set.
 */
export function SiteContextBadges({
  projectId,
  showSeason = true,
  variant = "bare",
}: {
  projectId: string;
  showSeason?: boolean;
  variant?: "bare" | "glass";
}) {
  const [ctx, setCtx] = useState<SiteContext | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => {
      const { getSiteContextAction } = await import("../app/actions");
      const context = await getSiteContextAction(projectId);
      if (!cancelled) setCtx(context);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!ctx) return null;
  if (!showSeason && ctx.planning_badges.length === 0) return null;

  const chips = (
    <div
      data-testid="site-context-badges"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        alignItems: "center",
      }}
    >
      {showSeason ? (
        <span
          data-testid="site-context-season"
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: 11,
            color: "var(--gs-ink-secondary)",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {ctx.season.label} · {ctx.sun.daylight_hours.toFixed(1)}h daylight
        </span>
      ) : null}
      {ctx.planning_badges.map((badge) => (
        <span
          key={badge.id}
          data-testid={`planning-badge-${badge.id}`}
          title={badge.label}
          style={{
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            padding: "2px 7px",
            borderRadius: 999,
            border: `1px solid color-mix(in srgb, ${SEVERITY_COLOR[badge.severity]} 55%, transparent)`,
            color: SEVERITY_COLOR[badge.severity],
            background: `color-mix(in srgb, ${SEVERITY_COLOR[badge.severity]} 10%, transparent)`,
            whiteSpace: "nowrap",
          }}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );

  if (variant === "bare") return chips;

  return (
    <div
      data-gs-glass-card
      style={{
        display: "flex",
        gap: 4,
        padding: "4px 8px",
        borderRadius: 10,
        maxWidth: 280,
        background: "color-mix(in srgb, var(--gs-glass) 38%, transparent)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
        border: "1px solid color-mix(in srgb, var(--gs-line) 35%, transparent)",
      }}
    >
      {chips}
    </div>
  );
}
