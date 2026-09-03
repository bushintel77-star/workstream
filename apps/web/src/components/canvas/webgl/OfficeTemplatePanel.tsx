"use client";

/**
 * Phase R — Office template panel (spec §17a/17b).
 *
 * `officeTemplate.ts` shipped with a data model and 15 tests and no surface:
 * nothing in the app imported it, so R.2's editor, R.3's sections, R.5's
 * binding, R.6's overrides and R.7's revert had nowhere to appear. This is
 * that surface.
 *
 * Three rules from the module, carried through to the UI:
 *   1. Binding is a REFERENCE, not a copy. The panel edits the BINDING, never
 *      the template — deviating from a standard is an override on this
 *      project, not a rewrite of the office's standard.
 *   2. Deviation is legal but never silent. Every override names what, who,
 *      when and why, and a null reason renders as "no reason given" rather
 *      than being hidden.
 *   3. A new version is an offer with a diff. Nothing changes until accepted,
 *      each row states its consequence against THIS drawing, and destructive
 *      rows (renumbering) default to unchecked.
 *
 * The section rail carries live counts, derived from the drawing — never
 * stored, so they cannot go stale.
 *
 * Binding: docs/MENTAL-CANVAS-ROADMAP.md Phase R.
 */

import { useMemo, useState } from "react";
import { useStudioStore } from "./studioStore";
import {
  defaultAccepted,
  diffForProject,
  isClean,
  provenanceLine,
  type Change,
  type DrawingCounts,
  type OfficeTemplate,
} from "./officeTemplate";
import { materialById } from "./materials";
import styles from "./OfficeTemplatePanel.module.css";

export interface OfficeTemplatePanelProps {
  onClose: () => void;
}

/** The sections R.3 names, in spec order. */
const SECTIONS = [
  { id: "planes", label: "Planes" },
  { id: "packs", label: "Trade packs" },
  { id: "materials", label: "Materials" },
  { id: "weights", label: "Line weights" },
  { id: "sheet", label: "Sheet + title block" },
  { id: "codes", label: "Schedule codes" },
  { id: "defaults", label: "Defaults" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function OfficeTemplatePanel({ onClose }: OfficeTemplatePanelProps) {
  const template = useStudioStore((s) => s.officeTemplate);
  const binding = useStudioStore((s) => s.templateBinding);
  const revertOverride = useStudioStore((s) => s.revertTemplateOverride);
  const acceptVersion = useStudioStore((s) => s.acceptTemplateVersion);
  const placements = useStudioStore((s) => s.placements);
  const strokes = useStudioStore((s) => s.sketchStrokes);
  const features = useStudioStore((s) => s.features);
  const sheets = useStudioStore((s) => s.sheets);
  const [section, setSection] = useState<SectionId>("planes");
  const [offer, setOffer] = useState<OfficeTemplate | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  /** R.2 — live counts, derived from the drawing. */
  const counts: DrawingCounts = useMemo(() => {
    const hardscape = features.filter(
      (f) => f.metadata.layer === "hardscape" || f.metadata.layer === "structure",
    ).length;
    return {
      trees: placements.length,
      beds: features.length - hardscape,
      hardscape,
      sheets: sheets.length,
      issuedSheets: sheets.filter((s) => s.issued).length,
      strokes: strokes.length,
    };
  }, [placements, features, sheets, strokes]);

  /** Section rail counts — what each section actually governs right now. */
  const sectionCount = (id: SectionId): number => {
    switch (id) {
      case "planes":
        return template.planes.length;
      case "packs":
        return 2;
      case "materials":
        return template.materials.length;
      case "weights":
        return template.weights.length;
      case "sheet":
        return template.sheet.titleBlockFields.length;
      case "codes":
        return (counts.trees ?? 0) + (counts.beds ?? 0) + (counts.hardscape ?? 0);
      case "defaults":
        return Object.keys(template.defaults).length;
    }
  };

  const offered: Change[] = useMemo(
    () => (offer ? diffForProject(template, offer, binding, counts) : []),
    [offer, template, binding, counts],
  );

  function openOffer() {
    // The offer a real service would push. Built here from the current
    // template so the diff is genuine — every row below is computed by
    // `diffForProject`, not written out by hand.
    const next: OfficeTemplate = {
      ...template,
      version: template.version + 1,
      publishedAt: new Date().toISOString().slice(0, 10),
      sheet: { ...template.sheet, scale: template.sheet.scale === 200 ? 100 : 200 },
      defaults: {
        ...template.defaults,
        snapM: template.defaults.snapM === 0.5 ? 0.25 : 0.5,
      },
      codes: {
        ...template.codes,
        tree: template.codes.tree === "T" ? "TR" : "T",
      },
    };
    const rows = diffForProject(template, next, binding, counts);
    setOffer(next);
    setAccepted(new Set(rows.filter(defaultAccepted).map((c) => String(c.path))));
  }

  function toggleAccepted(path: string) {
    setAccepted((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(path)) nextSet.delete(path);
      else nextSet.add(path);
      return nextSet;
    });
  }

  function applyOffer() {
    if (!offer) return;
    acceptVersion(
      offer,
      offered.filter((c) => accepted.has(String(c.path))),
      offered,
      "this session",
    );
    setOffer(null);
    setAccepted(new Set());
  }

  return (
    <div className={styles.scrim} onClick={onClose} data-testid="office-template-scrim">
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Office template"
        data-testid="office-template-panel"
      >
        <header className={styles.header}>
          <div>
            <div className={styles.title}>Office template</div>
            {/* R.9 — the provenance line that survives onto paper (17b). */}
            <div className={styles.provenance} data-testid="template-provenance">
              {provenanceLine(template, binding)}
            </div>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.actionBtn}
              onClick={openOffer}
              disabled={offer !== null}
              data-testid="template-offer-open"
              title="Review the next version as an offer with a diff"
            >
              New version
            </button>
            <button className={styles.actionBtn} onClick={onClose}>
              Close
            </button>
          </div>
        </header>

        {/* R.1 — conventions only. Stated, because the whole model depends on
            it and an operator has no other way to know. */}
        <div className={styles.rule} data-testid="template-conventions-only">
          Conventions only — no geometry, no site data, no design content. The
          binding is a reference: changing a standard reaches every bound
          project without writing to any of them.
        </div>

        <div className={styles.body}>
          <nav className={styles.rail} aria-label="Template sections">
            {SECTIONS.map((s) => {
              const overridden = binding.overrides.some((o) => o.path === s.id);
              return (
                <button
                  key={s.id}
                  className={`${styles.railItem} ${section === s.id ? styles.railItemActive : ""}`}
                  onClick={() => setSection(s.id)}
                  data-section={s.id}
                  data-overridden={overridden ? "true" : undefined}
                  aria-current={section === s.id}
                >
                  <span className={styles.railLabel}>{s.label}</span>
                  <span className={styles.railCount}>{sectionCount(s.id)}</span>
                </button>
              );
            })}
          </nav>

          <div className={styles.section} data-testid={`template-section-${section}`}>
            <TemplateSection section={section} template={template} />
          </div>
        </div>

        {/* R.6 / R.7 — overrides, named and revertible one at a time. */}
        <div className={styles.overrides} data-testid="template-overrides">
          <div className={styles.overridesHead}>
            Overrides
            <span className={styles.overridesCount}>
              {binding.overrides.length}
            </span>
          </div>
          {isClean(binding) ? (
            <div className={styles.overridesEmpty}>
              This project follows the standard exactly.
            </div>
          ) : (
            binding.overrides.map((o) => (
              <div key={String(o.path)} className={styles.overrideRow}>
                <span className={styles.overridePath}>{String(o.path)}</span>
                <span className={styles.overrideMeta}>
                  {o.by} · {o.at.slice(0, 10)}
                </span>
                <span className={styles.overrideReason}>
                  {/* A null reason is stated, never hidden (R.6). */}
                  {o.reason ?? "no reason given"}
                </span>
                <button
                  className={styles.revertBtn}
                  onClick={() => revertOverride(o.path)}
                  data-action="revert"
                  data-path={String(o.path)}
                  title={`Return ${String(o.path)} to the standard`}
                >
                  Revert
                </button>
              </div>
            ))
          )}
        </div>

        {/* R.8-R.10 — the version offer, with a stated consequence per row. */}
        {offer && (
          <div className={styles.offer} data-testid="template-offer">
            <div className={styles.offerHead}>
              v{template.version} → v{offer.version} — nothing changes until you
              accept
            </div>
            {offered.length === 0 && (
              <div className={styles.overridesEmpty}>
                This version changes nothing for this drawing.
              </div>
            )}
            {offered.map((c) => (
              <label
                key={String(c.path)}
                className={styles.offerRow}
                data-destructive={c.destructive ? "true" : undefined}
                data-conflicts={c.conflictsWithOverride ? "true" : undefined}
              >
                <input
                  type="checkbox"
                  checked={accepted.has(String(c.path))}
                  onChange={() => toggleAccepted(String(c.path))}
                  data-path={String(c.path)}
                />
                <span className={styles.offerLabel}>{c.label}</span>
                <span className={styles.offerAffects}>{c.affects}</span>
                {c.destructive && (
                  <span className={styles.offerFlag}>renumbers — off by default</span>
                )}
                {c.conflictsWithOverride && (
                  <span className={styles.offerFlag}>
                    conflicts with your override
                  </span>
                )}
              </label>
            ))}
            <div className={styles.offerActions}>
              <span className={styles.offerNote}>
                {accepted.size === offered.length && offered.length > 0
                  ? `Accepting everything moves this project to v${offer.version}.`
                  : `Declining any row keeps this project on v${template.version}; each decline is recorded as an override.`}
              </span>
              <button
                className={styles.actionBtn}
                onClick={applyOffer}
                data-testid="template-offer-apply"
              >
                Apply
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => {
                  setOffer(null);
                  setAccepted(new Set());
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** One section's conventions, read straight off the template. */
function TemplateSection({
  section,
  template,
}: {
  section: SectionId;
  template: OfficeTemplate;
}) {
  switch (section) {
    case "planes":
      return (
        <ul className={styles.list}>
          {template.planes.map((p) => (
            <li key={p.name} className={styles.listRow}>
              <span className={styles.rowKey}>{p.name}</span>
              <span className={styles.rowValue}>
                {p.z.toFixed(2)} m · {p.state}
                {p.locked ? " · locked" : ""}
              </span>
            </li>
          ))}
        </ul>
      );
    case "packs":
      return (
        <ul className={styles.list}>
          <li className={styles.listRow}>
            <span className={styles.rowKey}>Drafting</span>
            <span className={styles.rowValue}>{template.packs.drafting}</span>
          </li>
          <li className={styles.listRow}>
            <span className={styles.rowKey}>Sketch</span>
            <span className={styles.rowValue}>{template.packs.sketch}</span>
          </li>
        </ul>
      );
    case "materials":
      return (
        <ul className={styles.list}>
          {template.materials.map((id) => {
            const m = materialById(id);
            return (
              <li key={id} className={styles.listRow}>
                <span
                  className={styles.swatch}
                  style={{ background: m?.color ?? "transparent" }}
                  aria-hidden="true"
                />
                <span className={styles.rowKey}>{m?.label ?? id}</span>
                <span className={styles.rowValue}>
                  {m?.semantic ? `dash ${m.dash?.join("/")}` : "hue only"}
                </span>
              </li>
            );
          })}
        </ul>
      );
    case "weights":
      return (
        <ul className={styles.list}>
          {template.weights.map((w) => (
            <li key={w.purpose} className={styles.listRow}>
              <span className={styles.rowKey}>{w.purpose}</span>
              {/* R.4 — weights are stated in mm at issued scale, never px. */}
              <span className={styles.rowValue}>
                {w.mm.toFixed(2)} mm at issued scale · signature {w.signature}
              </span>
            </li>
          ))}
        </ul>
      );
    case "sheet":
      return (
        <ul className={styles.list}>
          <li className={styles.listRow}>
            <span className={styles.rowKey}>Size</span>
            <span className={styles.rowValue}>{template.sheet.size}</span>
          </li>
          <li className={styles.listRow}>
            <span className={styles.rowKey}>Scale</span>
            <span className={styles.rowValue}>1:{template.sheet.scale}</span>
          </li>
          <li className={styles.listRow}>
            <span className={styles.rowKey}>Title block</span>
            <span className={styles.rowValue}>
              {template.sheet.titleBlockFields.join(" · ")}
            </span>
          </li>
        </ul>
      );
    case "codes":
      return (
        <ul className={styles.list}>
          <li className={styles.listRow}>
            <span className={styles.rowKey}>Tree</span>
            <span className={styles.rowValue}>
              {template.codes.tree}
              {template.codes.startAt}
            </span>
          </li>
          <li className={styles.listRow}>
            <span className={styles.rowKey}>Bed</span>
            <span className={styles.rowValue}>
              {template.codes.bed}
              {template.codes.startAt}
            </span>
          </li>
          <li className={styles.listRow}>
            <span className={styles.rowKey}>Hardscape</span>
            <span className={styles.rowValue}>
              {template.codes.hardscape}
              {template.codes.startAt}
            </span>
          </li>
        </ul>
      );
    case "defaults":
      return (
        <ul className={styles.list}>
          <li className={styles.listRow}>
            <span className={styles.rowKey}>Snap</span>
            <span className={styles.rowValue}>{template.defaults.snapM} m</span>
          </li>
          <li className={styles.listRow}>
            <span className={styles.rowKey}>Units</span>
            <span className={styles.rowValue}>{template.defaults.units}</span>
          </li>
          <li className={styles.listRow}>
            <span className={styles.rowKey}>North from sheet up</span>
            <span className={styles.rowValue}>
              {template.defaults.northFromSheetUp}°
            </span>
          </li>
          <li className={styles.listRow}>
            <span className={styles.rowKey}>Vertical exaggeration</span>
            <span className={styles.rowValue}>
              ×{template.defaults.verticalExaggeration}
            </span>
          </li>
        </ul>
      );
  }
}
