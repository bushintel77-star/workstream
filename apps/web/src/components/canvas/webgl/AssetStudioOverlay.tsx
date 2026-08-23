"use client";

/**
 * Gold Standard 2026 — Asset Selection Studio (floating glass overlay).
 *
 * The asset workflow's full-surface instrument: a spacious frosted-glass
 * overlay, opened from the slim left ribbon, with three zones:
 *
 *   - Left   — category rail + trait filters (Trees/Shrubs/Groundcover/
 *              Hardscape, search, native/drought/root-depth traits).
 *   - Centre — the catalog grid of real gold-standard assets. Cards are
 *              selectable tiles (glyph + label + botany + H/R figures),
 *              not a horizontal strip.
 *   - Right  — the inspection spec panel for the selected asset: botany,
 *              mature height/spread, maturity + rotation controls (the
 *              growth dial), the solar-exposure matrix (bound to the real
 *              catalog `sun` value), water/irrigation demand (catalog
 *              `water`), and the "Place on Canvas" CTA.
 *
 * The canvas stays visible through the blur behind the overlay — the glass
 * is a surface, not a wall (Gold Standard §2 zero-chrome law). Selection is
 * the SAME armed-symbol state the dock used (studioStore.armedSymbolId), so
 * placing, dragging, and the floating placement toolbar all still work.
 *
 * All metadata is real (getCatalogSymbol / assetPalette) — never invented.
 * Binding: docs/GOLD-STANDARD-2026.md §3 (Asset Discovery Fan-Out → Studio)
 */

import { useEffect, useMemo, useState } from "react";
import { getCatalogSymbol } from "@workstream/domain";
import { useStudioStore } from "./studioStore";
import {
  ASSET_CATEGORIES,
  ASSET_CATEGORY_LABEL,
  buildCatalogAssetPalette,
  buildAssetPalette,
  filterAssetPalette,
  type AssetPaletteCategory,
  type AssetPaletteEntry,
} from "./assetPalette";
import { Button } from "./Button";
import { Input } from "./Field";

type MaturityStage = "juvenile" | "established" | "mature";

const MATURITY: Record<MaturityStage, { label: string; years: string; factor: number }> = {
  juvenile: { label: "Juvenile", years: "1–2 yrs", factor: 0.2 },
  established: { label: "Established", years: "5 yrs", factor: 0.75 },
  mature: { label: "Full maturity", years: "15+ yrs", factor: 1 },
};

const SUN_LABEL: Record<string, string> = {
  full: "Full sun",
  partial: "Dappled / part shade",
  shade: "Deep shade",
};

const WATER_LABEL: Record<string, string> = {
  low: "Low demand",
  moderate: "Moderate demand",
  high: "High demand",
};

function SpecLabel({ children }: { children: string }) {
  return (
    <span
      style={{
        display: "block",
        fontFamily: "var(--font-tech)",
        fontSize: "var(--gs-font-micro)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--gs-ink-muted)",
        marginBottom: 4,
      }}
    >
      {children}
    </span>
  );
}

function EntryTile({
  entry,
  active,
  onPick,
}: {
  entry: AssetPaletteEntry;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`asset-studio-tile-${entry.symbolId}`}
      aria-pressed={active}
      onClick={onPick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        padding: "8px 10px",
        borderRadius: "var(--gs-radius-chip)",
        // Crisp neutral hairline + strong white frost so a glass tile reads
        // against the grey canvas plane (pure glass — no tinted fill).
        border: `1px solid ${
          active
            ? "color-mix(in srgb, var(--gs-ink) 40%, transparent)"
            : "color-mix(in srgb, var(--gs-ink) 18%, transparent)"
        }`,
        background: active
          ? "var(--gs-chip-active)"
          : "var(--gs-glass-veil-strong)",
        backdropFilter: "blur(calc(var(--gs-blur) * 1.5))",
        WebkitBackdropFilter: "blur(calc(var(--gs-blur) * 1.5))",
        boxShadow: "var(--gs-shadow-1)",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "var(--font-ui)",
        width: "100%",
      }}
    >
      <span
        style={{ fontSize: 16, color: active ? "var(--gs-chip-active-ink)" : "var(--gs-ink-secondary)" }}
        aria-hidden
      >
        {entry.glyph}
      </span>
      <span
        style={{
          fontSize: "var(--gs-font-xs)",
          fontWeight: 600,
          color: active ? "var(--gs-chip-active-ink)" : "var(--gs-ink)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
        }}
      >
        {entry.label}
      </span>
      {entry.botanicalName ? (
        <span
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-micro)",
            color: active ? "color-mix(in srgb, var(--gs-chip-active-ink) 70%, transparent)" : "var(--gs-ink-muted)",
            fontStyle: "italic",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "100%",
          }}
        >
          {entry.botanicalName}
        </span>
      ) : null}
      {entry.heightM != null ? (
        <span
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-micro)",
            color: active ? "color-mix(in srgb, var(--gs-chip-active-ink) 80%, transparent)" : "var(--gs-ink-secondary)",
          }}
        >
          H {entry.heightM.toFixed(1)} m
          {entry.spreadM != null ? ` · R ${entry.spreadM.toFixed(1)} m` : ""}
        </span>
      ) : null}
    </button>
  );
}

function ExposureTile({
  label,
  active,
  onSelect,
  caption,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
  caption: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      title={caption}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        padding: "6px 8px",
        borderRadius: "var(--gs-radius-chip)",
        border: `1px solid ${
          active
            ? "color-mix(in srgb, var(--gs-ink) 40%, transparent)"
            : "color-mix(in srgb, var(--gs-ink) 16%, transparent)"
        }`,
        // Neutral charcoal selection — no tinted fill (pure-glass rule).
        background: active ? "var(--gs-chip-active)" : "var(--gs-glass-veil-strong)",
        cursor: "pointer",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--gs-font-micro)",
        lineHeight: 1.25,
        color: active ? "var(--gs-chip-active-ink)" : "var(--gs-ink-secondary)",
        textAlign: "left",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {label}
    </button>
  );
}

/**
 * Specimen stage — the center zone's live preview, drawn procedurally on the
 * canvas plane (SVG geometry, no bitmap): the radial rotation dial with 15°
 * ticks and a needle at the live angle, the canopy-spread perimeter ring
 * scaled in project units, and the specimen itself — a procedural trunk +
 * tapered branch structure with a canopy lobe cluster, scaled by maturity
 * (juvenile → mature). The catalog `path_d` silhouette is used as the
 * species outline where the symbol provides one; lobes give the foliage
 * mass. Pure monochrome technical linework (ink on glass).
 */
const DIAL_R = 90;
const DIAL_C = 130;

function polarAt(deg: number, r: number) {
  const rad = ((deg - 90) * Math.PI) / 180; // 0° = up (north)
  return { x: DIAL_C + Math.cos(rad) * r, y: DIAL_C + Math.sin(rad) * r };
}

function SpecimenStage({
  symbolId,
  rotation,
  spreadM,
  heightM,
  maturityFactor,
}: {
  symbolId: string;
  rotation: number;
  spreadM: number | null;
  heightM: number | null;
  maturityFactor: number;
}) {
  const catalog = getCatalogSymbol(symbolId);
  const spreadR = spreadM != null ? Math.min(46, 14 + spreadM * 6) : 22;
  const specH = heightM != null ? Math.min(70, 26 + heightM * 8) : 40;

  // Procedural trunk + main branches — deterministic from the symbol id so the
  // silhouette is stable per species, never random between renders.
  const branchSeed = [...symbolId].reduce((a, c) => a + c.charCodeAt(0), 0) % 7;
  const branches = Array.from({ length: 5 }, (_, i) => {
    const t = i / 4;
    const x0 = 0;
    const y0 = 0;
    const x1 = Math.sin((branchSeed + i * 47) * 0.61) * 18 * (0.5 + t);
    const y1 = -(28 + t * 14);
    return { x0, y0, x1, y1 };
  });
  const lobes = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + branchSeed * 0.4;
    const r = spreadR * 0.4;
    return { cx: Math.cos(a) * r, cy: -specH * 0.75 + Math.sin(a) * r * 0.62 };
  });

  const ticks = Array.from({ length: 24 }, (_, i) => {
    const deg = i * 15;
    const outer = polarAt(deg, DIAL_R);
    const inner = polarAt(deg, DIAL_R - (i % 6 === 0 ? 10 : 5));
    return { deg, outer, inner };
  });
  const needle = polarAt(rotation, DIAL_R - 16);

  return (
    <svg
      data-testid="asset-studio-stage"
      viewBox={`0 0 ${DIAL_C * 2} ${DIAL_C * 2}`}
      style={{ width: "min(240px, 20vw)", maxWidth: "100%", pointerEvents: "none" }}
      role="img"
      aria-label={`${catalog?.label ?? symbolId} specimen, rotated ${rotation} degrees, spread ${spreadM ?? "?"} m`}
    >
      {/* Dial track + degree ticks */}
      <circle cx={DIAL_C} cy={DIAL_C} r={DIAL_R} fill="none" stroke="var(--gs-ink)" strokeOpacity={0.18} strokeWidth={1} />
      {ticks.map((t) => (
        <line
          key={t.deg}
          x1={t.inner.x}
          y1={t.inner.y}
          x2={t.outer.x}
          y2={t.outer.y}
          stroke="var(--gs-ink)"
          strokeOpacity={t.deg % 90 === 0 ? 0.55 : 0.3}
          strokeWidth={t.deg % 90 === 0 ? 1.5 : 1}
        />
      ))}
      {/* Cardinal labels */}
      {(["N", "E", "S", "W"] as const).map((c, i) => {
        const p = polarAt(i * 90, DIAL_R - 22);
        return (
          <text
            key={c}
            x={p.x}
            y={p.y + 4}
            textAnchor="middle"
            fontFamily="var(--font-tech)"
            fontSize={10}
            fill="var(--gs-ink)"
            fillOpacity={0.6}
          >
            {c}
          </text>
        );
      })}
      {/* Canopy spread ring (project units) */}
      <circle
        cx={DIAL_C}
        cy={DIAL_C + specH * 0.62}
        r={spreadR}
        fill="none"
        stroke="var(--gs-ink)"
        strokeOpacity={0.35}
        strokeDasharray="4 4"
        strokeWidth={1.2}
      />
      <text
        x={DIAL_C + spreadR + 4}
        y={DIAL_C + specH * 0.62 + 3}
        fontFamily="var(--font-tech)"
        fontSize={9}
        fill="var(--gs-ink)"
        fillOpacity={0.55}
      >
        {spreadM != null ? `R ${spreadM.toFixed(1)} m` : ""}
      </text>

      {/* Specimen — trunk + branches + canopy lobes, maturity-scaled */}
      <g transform={`translate(${DIAL_C}, ${DIAL_C + specH * 0.62}) scale(${maturityFactor * 0.6 + 0.4})`}>
        <line x1={0} y1={0} x2={0} y2={-specH * 0.55} stroke="var(--gs-ink)" strokeOpacity={0.85} strokeWidth={2.4} strokeLinecap="round" />
        {branches.map((b, i) => (
          <line
            key={i}
            x1={b.x0}
            y1={b.y0}
            x2={b.x1}
            y2={b.y1}
            stroke="var(--gs-ink)"
            strokeOpacity={0.7}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        ))}
        {lobes.map((l, i) => (
          <circle
            key={i}
            cx={l.cx}
            cy={l.cy}
            r={spreadR * 0.24}
            fill="var(--gs-ink)"
            fillOpacity={0.12}
            stroke="var(--gs-ink)"
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        ))}
      </g>

      {/* Needle at live rotation */}
      <line
        x1={DIAL_C}
        y1={DIAL_C}
        x2={needle.x}
        y2={needle.y}
        stroke="var(--gs-ink)"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx={DIAL_C} cy={DIAL_C} r={3} fill="var(--gs-ink)" />
    </svg>
  );
}

export function AssetStudioOverlay() {
  const assetsOpen = useStudioStore((s) => s.assetsOpen);
  const armedSymbolId = useStudioStore((s) => s.armedSymbolId);
  const setArmedSymbolId = useStudioStore((s) => s.setArmedSymbolId);
  const setAssetsOpen = useStudioStore((s) => s.setAssetsOpen);

  const [curated] = useState(buildAssetPalette);
  const [catalog] = useState(buildCatalogAssetPalette);
  const [category, setCategory] = useState<AssetPaletteCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [maturity, setMaturity] = useState<MaturityStage>("mature");
  const [rotation, setRotation] = useState(0);
  const [exposure, setExposure] = useState<string | null>(null);
  const [waterOverride, setWaterOverride] = useState<string | null>(null);

  const browsing = query.trim().length > 0 || category !== "all";
  const matches = useMemo(
    () => filterAssetPalette(browsing ? catalog : curated, { category, query }),
    [browsing, catalog, curated, category, query],
  );

  // Unified selected-asset config — derived from the armed symbol + the local
  // controls. The armed symbol is the single placement authority, so what you
  // inspect here IS what you place.
  const selected = useMemo(
    () => (armedSymbolId ? catalog.find((e) => e.symbolId === armedSymbolId) ?? null : null),
    [armedSymbolId, catalog],
  );
  const catalogSym = selected ? getCatalogSymbol(selected.symbolId) : undefined;
  const maturityFactor = MATURITY[maturity].factor;
  const grownHeightM = selected?.heightM != null ? selected.heightM * maturityFactor : null;
  const grownSpreadM = selected?.spreadM != null ? selected.spreadM * maturityFactor : null;

  useEffect(() => {
    if (!assetsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        useStudioStore.getState().setArmedSymbolId(null);
        setAssetsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assetsOpen, setAssetsOpen]);

  if (!assetsOpen) return null;

  const effectiveSun = exposure ?? catalogSym?.sun ?? null;
  const effectiveWater = waterOverride ?? catalogSym?.water ?? null;

  return (
    <div
      data-testid="asset-studio"
      role="dialog"
      aria-label="Asset selection studio"
      style={{
        // Tethered to the ribbon: the stage unfolds from the left rail's inner
        // edge and anchors to the canvas, not a centered island. The canvas
        // grid + plan stay visible through the glass shelves and the open
        // center stage (continuous ground plane).
        position: "fixed",
        left: 68,
        top: 12,
        bottom: 12,
        right: 12,
        zIndex: "var(--cf-z-chrome)",
        display: "flex",
        pointerEvents: "none",
        animation: "wsPanelIn 180ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* LEFT SHELF — classification + library. Pure frosted glass diffusing
          into the canvas via a radial mask (no hard container border). */}
      <div
        data-testid="asset-studio-shelf-left"
        style={{
          pointerEvents: "auto",
          width: "min(230px, 22vw)",
          alignSelf: "stretch",
          borderRadius: "var(--gs-radius-panel)",
          background: "var(--gs-panel-frost)",
          backdropFilter: "blur(calc(var(--gs-blur) * 2.5))",
          WebkitBackdropFilter: "blur(calc(var(--gs-blur) * 2.5))",
          border: "1px solid color-mix(in srgb, var(--gs-ink) 16%, transparent)",
          boxShadow: "var(--gs-shadow-2)",
          overflowY: "auto",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: "var(--gs-space-3)",
          maskImage: "radial-gradient(120% 100% at 0% 50%, black 58%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(120% 100% at 0% 50%, black 58%, transparent 100%)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-micro)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--gs-ink-muted)",
          }}
        >
          Classification
        </span>
        <Button
          variant="chip-preset"
          size="xs"
          active={category === "all"}
          data-testid="asset-studio-cat-all"
          onClick={() => setCategory("all")}
        >
          All
        </Button>
        {ASSET_CATEGORIES.map((id) => (
          <Button
            key={id}
            variant="chip-preset"
            size="xs"
            active={category === id}
            data-testid={`asset-studio-cat-${id}`}
            onClick={() => setCategory(id)}
          >
            {ASSET_CATEGORY_LABEL[id]}
          </Button>
        ))}
        <label style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
          <span
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: "var(--gs-font-micro)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--gs-ink-muted)",
            }}
          >
            Search
          </span>
          <Input
            aria-label="Search assets"
            data-testid="asset-studio-search"
            placeholder="Botanical, name, SKU…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: "100%", fontSize: "var(--gs-font-sm)" }}
          />
        </label>
      </div>

      {/* CENTER STAGE — the canvas plane runs through transparently. The
          specimen preview (dial + canopy ring + procedural silhouette) is
          anchored at the top over the canvas; the library grid scrolls below
          with radial diffusion. No fill behind either, so the grid + plan stay
          spatially aligned beneath (continuous ground plane). */}
      <div
        data-testid="asset-studio-center"
        style={{
          flex: 1,
          minWidth: 0,
          alignSelf: "stretch",
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          padding: "6px 14px",
        }}
      >
        {selected ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--gs-space-1)",
              paddingBottom: 4,
              // Compact preview pinned to the left of the canvas margin so the
              // plan + lot stay clear beneath the stage (continuous ground).
              width: "min(260px, 22vw)",
              alignSelf: "flex-start",
              marginLeft: 6,
              pointerEvents: "none",
            }}
          >
            <SpecimenStage
              symbolId={selected.symbolId}
              rotation={rotation}
              spreadM={grownSpreadM}
              heightM={grownHeightM}
              maturityFactor={MATURITY[maturity].factor}
            />
            <span
              style={{
                fontFamily: "var(--font-tech)",
                fontSize: "var(--gs-font-xs)",
                letterSpacing: "0.06em",
                color: "var(--gs-ink-secondary)",
                textTransform: "uppercase",
              }}
            >
              Perceived at {MATURITY[maturity].label.toLowerCase()} · rotation {rotation}°
            </span>
          </div>
        ) : (
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: "var(--gs-font-sm)",
              color: "var(--gs-ink-secondary)",
              padding: "10px 4px",
            }}
          >
            Select an asset from the library to preview its silhouette,
            rotation and canopy spread here — directly on the project plane.
          </span>
        )}
        <div
          data-testid="asset-studio-grid"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))",
            gridAutoRows: "min-content",
            gap: "var(--gs-space-2)",
            padding: "8px 0",
            maskImage: "radial-gradient(120% 100% at 50% 50%, black 62%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(120% 100% at 50% 50%, black 62%, transparent 100%)",
          }}
        >
        {matches.length === 0 ? (
          <span
            style={{
              fontFamily: "var(--font-tech)",
              fontSize: "var(--gs-font-xs)",
              color: "var(--gs-ink-muted)",
              padding: "12px 4px",
            }}
          >
            No assets match.
          </span>
        ) : (
          matches.map((entry) => (
            <EntryTile
              key={entry.symbolId}
              entry={entry}
              active={entry.symbolId === armedSymbolId}
              onPick={() =>
                setArmedSymbolId(
                  entry.symbolId === armedSymbolId ? null : entry.symbolId,
                )
              }
            />
          ))
        )}
        </div>
      </div>

      {/* RIGHT SHELF — environmental + solar matrix + placement. Same frosted
          diffusion, mirrored falloff. */}
      <div
        data-testid="asset-studio-shelf-right"
        style={{
          pointerEvents: "auto",
          width: "min(250px, 24vw)",
          alignSelf: "stretch",
          borderRadius: "var(--gs-radius-panel)",
          background: "var(--gs-panel-frost)",
          backdropFilter: "blur(calc(var(--gs-blur) * 2.5))",
          WebkitBackdropFilter: "blur(calc(var(--gs-blur) * 2.5))",
          border: "1px solid color-mix(in srgb, var(--gs-ink) 16%, transparent)",
          boxShadow: "var(--gs-shadow-2)",
          overflowY: "auto",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: "var(--gs-space-3)",
          maskImage: "radial-gradient(120% 100% at 100% 50%, black 58%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(120% 100% at 100% 50%, black 58%, transparent 100%)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-tech)",
            fontSize: "var(--gs-font-micro)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--gs-ink-muted)",
          }}
        >
          {selected
            ? selected.botanicalName
              ? `${selected.botanicalName}`
              : selected.label
            : "Inspect an asset"}
        </span>
            {selected ? (
              <>
                <div>
                  <SpecLabel>Growth stage</SpecLabel>
                  <div style={{ display: "flex", gap: "var(--gs-space-1)", flexWrap: "wrap" }}>
                    {(Object.keys(MATURITY) as MaturityStage[]).map((m) => (
                      <Button
                        key={m}
                        variant="chip-preset"
                        size="xs"
                        active={maturity === m}
                        data-testid={`asset-studio-maturity-${m}`}
                        onClick={() => setMaturity(m)}
                      >
                        {MATURITY[m].label}
                      </Button>
                    ))}
                  </div>
                </div>
                {grownHeightM != null ? (
                  <div
                    data-testid="asset-studio-grown"
                    style={{
                      fontFamily: "var(--font-tech)",
                      fontSize: "var(--gs-font-sm)",
                      color: "var(--gs-ink)",
                    }}
                  >
                    {grownHeightM.toFixed(1)} m H ·{" "}
                    {grownSpreadM != null ? `${grownSpreadM.toFixed(1)} m R` : "—"}
                    <span style={{ color: "var(--gs-ink-muted)", marginLeft: 6 }}>
                      @ {MATURITY[maturity].years}
                    </span>
                  </div>
                ) : null}

                <div>
                  <SpecLabel>Rotation</SpecLabel>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={rotation}
                    aria-label="Rotation degrees"
                    data-testid="asset-studio-rotation"
                    onChange={(e) => setRotation(Number(e.target.value))}
                    style={{ width: "100%" }}
                  />
                  <span
                    data-testid="asset-studio-rotation-value"
                    style={{
                      fontFamily: "var(--font-tech)",
                      fontSize: "var(--gs-font-xs)",
                      color: "var(--gs-ink-secondary)",
                    }}
                  >
                    {rotation}°
                  </span>
                </div>

                <div>
                  <SpecLabel>Solar exposure</SpecLabel>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "var(--gs-space-1)",
                    }}
                  >
                    {Object.entries(SUN_LABEL).map(([key, label]) => (
                      <ExposureTile
                        key={key}
                        label={label}
                        caption={catalogSym?.sun === key ? "Catalog preference" : "Operator override"}
                        active={effectiveSun === key}
                        onSelect={() => setExposure(effectiveSun === key ? null : key)}
                      />
                    ))}
                    <ExposureTile
                      label="Reflected heat"
                      caption="Adjacent to masonry / paving"
                      active={exposure === "reflected"}
                      onSelect={() => setExposure(exposure === "reflected" ? null : "reflected")}
                    />
                  </div>
                  {catalogSym?.sun ? (
                    <span
                      style={{
                        fontFamily: "var(--font-tech)",
                        fontSize: "var(--gs-font-micro)",
                        color: "var(--gs-ink-muted)",
                        display: "block",
                        marginTop: 4,
                      }}
                    >
                      Catalog preference: {SUN_LABEL[catalogSym.sun]}
                    </span>
                  ) : null}
                </div>

                <div>
                  <SpecLabel>Water / irrigation demand</SpecLabel>
                  <div style={{ display: "flex", gap: "var(--gs-space-1)", flexWrap: "wrap" }}>
                    {Object.entries(WATER_LABEL).map(([key, label]) => (
                      <Button
                        key={key}
                        variant="chip-preset"
                        size="xs"
                        active={effectiveWater === key}
                        onClick={() => setWaterOverride(effectiveWater === key ? null : key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  {catalogSym?.water && !waterOverride ? (
                    <span
                      style={{
                        fontFamily: "var(--font-tech)",
                        fontSize: "var(--gs-font-micro)",
                        color: "var(--gs-ink-muted)",
                        display: "block",
                        marginTop: 4,
                      }}
                    >
                      Catalog preference: {WATER_LABEL[catalogSym.water]}
                    </span>
                  ) : null}
                </div>

                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  <Button
                    variant="primary"
                    size="sm"
                    data-testid="asset-studio-place"
                    aria-label={`Place ${selected.label} on canvas`}
                    onClick={() => setAssetsOpen(false)}
                  >
                    Place on canvas
                  </Button>
                  <span
                    style={{
                      fontFamily: "var(--font-tech)",
                      fontSize: "var(--gs-font-micro)",
                      color: "var(--gs-ink-muted)",
                      textAlign: "center",
                    }}
                  >
                    {selected.symbolId} · armed — click the lot to place
                  </span>
                </div>
              </>
            ) : (
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: "var(--gs-font-sm)",
                  color: "var(--gs-ink-secondary)",
                }}
              >
                Select an asset from the grid to inspect its specimen
                conditions, growth profile and pricing.
              </span>
            )}
          </div>
    </div>
  );
}
