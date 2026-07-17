"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import type { CadDocument } from "@workstream/contracts";
import {
  acceptCadAction,
  downloadCadDxfAction,
  editCadAction,
  generateCadAction,
} from "../app/actions";
import s from "../styles/app.module.css";
import css from "./aiCadStudio.module.css";

type Props = {
  projectId: string;
  projectAddress: string;
  aerialUri: string;
  initialDocument: CadDocument | null;
  initialSvg: string | null;
  initialGhostCount: number;
  hasSketch: boolean;
};

export function AiCadStudio({
  projectId,
  projectAddress,
  aerialUri,
  initialDocument,
  initialSvg,
  initialGhostCount,
  hasSketch,
}: Props) {
  const [document, setDocument] = useState(initialDocument);
  const [svg, setSvg] = useState(initialSvg);
  const [ghostCount, setGhostCount] = useState(initialGhostCount);
  const [rationale, setRationale] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const applyResult = useCallback(
    (result: {
      document: CadDocument | null;
      svg: string | null;
      ghost_count: number;
      rationale?: string;
    }) => {
      setDocument(result.document);
      setSvg(result.svg);
      setGhostCount(result.ghost_count);
      if (result.rationale) setRationale(result.rationale);
      setError(null);
    },
    [],
  );

  const onGenerate = () => {
    startTransition(async () => {
      try {
        const result = await generateCadAction(projectId);
        applyResult(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Generate failed");
      }
    });
  };

  const onEdit = () => {
    const text = instruction.trim();
    if (!text) return;
    startTransition(async () => {
      try {
        const result = await editCadAction(projectId, text);
        applyResult(result);
        setInstruction("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Edit failed");
      }
    });
  };

  const onAccept = () => {
    startTransition(async () => {
      try {
        const result = await acceptCadAction(projectId);
        applyResult(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Accept failed");
      }
    });
  };

  const onDownloadDxf = () => {
    startTransition(async () => {
      try {
        const dxf = await downloadCadDxfAction(projectId);
        const blob = new Blob([dxf], { type: "application/dxf" });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = url;
        a.download = `workstream-${projectId.slice(0, 8)}.dxf`;
        a.click();
        URL.revokeObjectURL(url);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "DXF download failed");
      }
    });
  };

  const layers = document?.layers ?? [];
  const entityCount = document?.entities.length ?? 0;

  return (
    <div className={css.root} data-testid="ai-cad-studio">
      <header className={css.header}>
        <div>
          <p className={s.meta}>
            <Link href={`/projects/${projectId}/design`}>? Sketch studio</Link>
            {" · "}
            <Link href={`/projects/${projectId}/design/develop`}>Develop</Link>
          </p>
          <h1 className={css.title}>AI CAD</h1>
          <p className={css.lede}>
            Metre-space CAD from your sketch — ghosts until you accept. Export
            DXF for LibreCAD. Indicative only — not a construction drawing.
          </p>
          <p className={css.address}>{projectAddress}</p>
        </div>
        <div className={css.actions}>
          <button
            type="button"
            className={s.btnAccent}
            disabled={pending || !hasSketch}
            onClick={onGenerate}
          >
            {document ? "Regenerate AI CAD" : "Generate AI CAD"}
          </button>
          <button
            type="button"
            className={s.btn}
            disabled={pending || ghostCount === 0}
            onClick={onAccept}
          >
            Accept ghosts ({ghostCount})
          </button>
          <button
            type="button"
            className={s.btnGhost}
            disabled={pending || !document}
            onClick={onDownloadDxf}
          >
            Download DXF
          </button>
        </div>
      </header>

      {!hasSketch ? (
        <div className={s.banner}>
          Save placements in the sketch studio before upgrading to AI CAD.{" "}
          <Link href={`/projects/${projectId}/design`}>Open sketch</Link>
        </div>
      ) : null}

      {error ? <div className={s.error}>{error}</div> : null}
      {rationale ? <p className={css.rationale}>{rationale}</p> : null}

      <div className={css.layout}>
        <div className={css.canvasWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={aerialUri}
            alt="Site aerial"
            className={css.aerial}
          />
          {svg ? (
            <div
              className={css.svgOverlay}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className={css.emptyOverlay}>
              {hasSketch
                ? "Generate AI CAD to overlay metre-space geometry."
                : "Sketch required."}
            </div>
          )}
          <p className={css.honesty}>
            Concept / working-planning CAD — confirm on site · title · locate.
            LibreCAD DXF for draftsperson handoff.
          </p>
        </div>

        <aside className={css.rail}>
          <h2 className={css.railTitle}>AI rail</h2>
          <label className={css.label} htmlFor="cad-instruction">
            Edit with natural language
          </label>
          <textarea
            id="cad-instruction"
            className={css.textarea}
            rows={4}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='e.g. "Add 3 m TRP on the NW tree" or "Offset paving 0.5 m"'
            disabled={pending}
          />
          <button
            type="button"
            className={s.btnAccent}
            disabled={pending || !instruction.trim()}
            onClick={onEdit}
          >
            Apply edit
          </button>

          <h3 className={css.railSub}>Document</h3>
          <ul className={css.stats}>
            <li>
              Entities <strong>{entityCount}</strong>
            </li>
            <li>
              Ghosts <strong>{ghostCount}</strong>
            </li>
            <li>
              Size{" "}
              <strong>
                {document
                  ? `${document.width_m.toFixed(1)} × ${document.height_m.toFixed(1)} m`
                  : "—"}
              </strong>
            </li>
          </ul>

          <h3 className={css.railSub}>Layers</h3>
          <ul className={css.layerList}>
            {layers.map((l) => (
              <li key={l.name}>{l.name}</li>
            ))}
            {layers.length === 0 ? <li className={css.muted}>None yet</li> : null}
          </ul>

          {pending ? <p className={css.muted}>Working…</p> : null}
        </aside>
      </div>
    </div>
  );
}
