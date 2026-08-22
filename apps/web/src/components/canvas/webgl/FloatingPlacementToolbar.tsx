"use client";

/**
 * Gold Standard 2026 — Floating Placement Toolbar.
 *
 * A compact cursor-following toolbar that appears when an asset is armed.
 * Shows the armed symbol glyph + name, live cost preview, and placement
 * mode toggles (single / area / row). Positioned near the cursor so the
 * operator never has to look away from the canvas.
 *
 * Binding: docs/GOLD-STANDARD-2026.md §3 (Asset Discovery Fan-Out)
 */

import { useStudioStore } from "./studioStore";
import { getCatalogSymbol } from "@workstream/domain";
import { mapSymbolToStudioType } from "../handoff/state/studioAiEngine";
import { STUDIO_ITEM_TYPE_LABEL } from "../handoff/studioCatalog";
import { estimatedCostPerUnit, formatCostPreview } from "./costPreview";
import { GLYPH_BY_TYPE } from "./assetPalette";
import { Button } from "./Button";

const GOLD = "var(--gs-primary)";

/** Offset from cursor (px) so the toolbar doesn't obscure the click target. */
const OFFSET_X = 16;
const OFFSET_Y = -8;

export function FloatingPlacementToolbar() {
  const armedSymbolId = useStudioStore((s) => s.armedSymbolId);
  const pointerClientPos = useStudioStore((s) => s.pointerClientPos);
  const areaPlantActive = useStudioStore((s) => s.areaPlantActive);
  const setAreaPlantActive = useStudioStore((s) => s.setAreaPlantActive);
  const rowPlantActive = useStudioStore((s) => s.rowPlantActive);
  const setRowPlantActive = useStudioStore((s) => s.setRowPlantActive);
  const massPlantPreviewCount = useStudioStore((s) => s.massPlantPreviewCount);

  if (!armedSymbolId || !pointerClientPos) return null;

  const type = mapSymbolToStudioType(armedSymbolId);
  const glyph = GLYPH_BY_TYPE[type] ?? "?";
  const catalog = getCatalogSymbol(armedSymbolId);
  const label = catalog?.label ?? STUDIO_ITEM_TYPE_LABEL[type];

  const perUnit = estimatedCostPerUnit(armedSymbolId);
  const count =
    (areaPlantActive || rowPlantActive) && massPlantPreviewCount > 0
      ? massPlantPreviewCount
      : 1;
  const total = perUnit * count;

  return (
    <div
      data-testid="floating-placement-toolbar"
      style={{
        position: "fixed",
        left: pointerClientPos.x + OFFSET_X,
        top: pointerClientPos.y + OFFSET_Y,
        transform: "translateY(-100%)",
        display: "flex",
        alignItems: "center",
        gap: "var(--gs-space-2)",
        padding: "4px 10px",
        borderRadius: "var(--gs-radius-pill)",
        border: `1px solid color-mix(in srgb, ${GOLD} 40%, transparent)`,
        background: "color-mix(in srgb, var(--gs-glass) 52%, transparent)",
        backdropFilter: "blur(var(--gs-blur))",
        WebkitBackdropFilter: "blur(var(--gs-blur))",
        pointerEvents: "auto",
        fontFamily: "var(--font-tech)",
        fontSize: "var(--gs-font-xs)",
        color: GOLD,
        whiteSpace: "nowrap",
        zIndex: "var(--cf-z-app)",
        boxShadow: "var(--gs-shadow-3)",
        transition: "left 0.05s linear, top 0.05s linear",
      }}
    >
      {/* Glyph + name */}
      <span
        style={{
          fontSize: 16,
          lineHeight: 1,
          color: GOLD,
          flex: "0 0 auto",
        }}
        aria-hidden
      >
        {glyph}
      </span>
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontWeight: 600,
          color: "var(--gs-ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 120,
        }}
      >
        {label}
      </span>

      {/* Cost preview */}
      {perUnit > 0 && (
        <span
          data-testid="floating-cost-preview"
          style={{
            fontFamily: "var(--font-tech)",
            color: "var(--gs-ink-secondary)",
            opacity: 0.85,
          }}
        >
          {count > 1
            ? `${formatCostPreview(total)} (${count} × ${formatCostPreview(perUnit)})`
            : `${formatCostPreview(perUnit)}/ea`}
        </span>
      )}

      {/* Separator */}
      <span
        style={{
          width: 1,
          height: 14,
          background: "var(--gs-line)",
          flex: "0 0 auto",
        }}
      />

      {/* Mode toggles */}
      <Button
        variant="chip-preset"
        size="xs"
        active={!areaPlantActive && !rowPlantActive}
        onClick={() => {
          setAreaPlantActive(false);
          setRowPlantActive(false);
        }}
        title="Single placement — click to place one"
        style={{ padding: "1px 6px", fontSize: "var(--gs-font-xs)" }}
      >
        1×
      </Button>
      <Button
        variant="chip-preset"
        size="xs"
        active={areaPlantActive}
        data-testid="floating-area-plant"
        onClick={() => setAreaPlantActive(!areaPlantActive)}
        title="Area plant — drag a box to mass-plant at mature spacing"
        style={{ padding: "1px 6px", fontSize: "var(--gs-font-xs)" }}
      >
        Area
      </Button>
      <Button
        variant="chip-preset"
        size="xs"
        active={rowPlantActive}
        data-testid="floating-row-plant"
        onClick={() => setRowPlantActive(!rowPlantActive)}
        title="Row plant — drag a run to row-plant at mature spacing"
        style={{ padding: "1px 6px", fontSize: "var(--gs-font-xs)" }}
      >
        Row
      </Button>

      {/* Esc hint */}
      <span
        style={{
          fontFamily: "var(--font-tech)",
          fontSize: "var(--gs-font-xs)",
          color: "var(--gs-ink-muted)",
          opacity: 0.6,
        }}
      >
        Esc
      </span>
    </div>
  );
}
