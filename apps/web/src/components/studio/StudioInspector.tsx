"use client";

import Link from "next/link";
import {
  isTier1WrightsTerrace,
  WIKIMEDIA_TREE_ATTRIBUTION,
} from "@workstream/domain";
import type { CatalogPlacement, CatalogSymbol } from "@workstream/contracts";
import { DesignAssetGlyph } from "./DesignAssetGlyph";
import ins from "./studioInspector.module.css";

type Props = {
  projectId: string;
  projectAddress: string;
  placement: CatalogPlacement | null;
  symbol: CatalogSymbol | null;
  gardenAreaM2?: number;
  onLabelChange: (label: string) => void;
  onRotationChange: (deg: number) => void;
};

export function StudioInspector({
  projectId,
  projectAddress,
  placement,
  symbol,
  gardenAreaM2,
  onLabelChange,
  onRotationChange,
}: Props) {
  if (!placement || !symbol) {
    return (
      <p className={ins.empty}>select an element<br />to view properties</p>
    );
  }

  const tier1 = isTier1WrightsTerrace(projectAddress);
  const isWiki = placement.symbol_id.startsWith("wikimedia-tree-");
  const indicativeArea =
    gardenAreaM2 && symbol.default_width_m
      ? `~${Math.round((symbol.default_width_m ** 2 * placement.scale) * 0.12)} m² indicative`
      : null;

  return (
    <div className={ins.panel}>
      <p className={ins.section}>Symbol</p>
      <div className={ins.symbolRow}>
        <DesignAssetGlyph symbol={symbol} size="lg" />
        <div>
          <p className={ins.symbolName}>{symbol.label}</p>
          <span className={ins.badge}>{symbol.category}</span>
        </div>
      </div>

      <p className={ins.section}>Position</p>
      <div className={ins.fieldRow}>
        <span className={ins.fieldLabel}>X</span>
        <span className={ins.readout}>{placement.x_pct.toFixed(1)}%</span>
      </div>
      <div className={ins.fieldRow}>
        <span className={ins.fieldLabel}>Y</span>
        <span className={ins.readout}>{placement.y_pct.toFixed(1)}%</span>
      </div>

      <p className={ins.section}>Properties</p>
      <div className={ins.fieldRow}>
        <span className={ins.fieldLabel}>Label</span>
        <input
          className={ins.input}
          value={placement.label ?? symbol.label}
          onChange={(e) => onLabelChange(e.target.value)}
        />
      </div>
      <div className={ins.fieldRow}>
        <span className={ins.fieldLabel}>Rotation</span>
        <input
          className={ins.input}
          type="number"
          min={0}
          max={360}
          value={placement.rotation_deg}
          onChange={(e) => onRotationChange(Number(e.target.value))}
        />
      </div>
      {symbol.sun || symbol.water ? (
        <>
          <p className={ins.section}>Plant metadata</p>
          <p className={ins.meta}>
            {symbol.sun ? `Sun: ${symbol.sun}` : null}
            {symbol.water ? ` · Water: ${symbol.water}` : null}
          </p>
        </>
      ) : null}

      {indicativeArea ? (
        <p className={ins.indicative}>{indicativeArea}</p>
      ) : null}

      {isWiki ? (
        <p className={ins.attribution}>CC BY-SA 4.0 · Heinrich Böll Foundation</p>
      ) : null}

      {tier1 ? (
        <Link
          href={`/projects/${projectId}?mode=quote`}
          className={ins.tier1Link}
        >
          Tier-1 zone - Open quote
        </Link>
      ) : null}

      <p className={ins.footer}>indicative — confirm on site</p>
    </div>
  );
}
