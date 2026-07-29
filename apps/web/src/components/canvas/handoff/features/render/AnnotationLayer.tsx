"use client";

import type { CanvasAnnotation } from "@workstream/contracts";
import type { StudioItem } from "../../studioCatalog";
import { seededRandom, wobbledLeaderControl } from "./seededRandom";
import css from "./annotations.module.css";

type Props = {
  annotations: CanvasAnnotation[];
  items: StudioItem[];
  selectedId: string | null;
  night: boolean;
  /** 0–1 layer opacity. */
  opacity: number;
  /** draft fidelity → 50% extra dim. */
  draft: boolean;
  /** Technical pen → orange --signal callout ink. */
  technicalInk?: boolean;
  onSelect: (id: string | null) => void;
  onMoveNote: (id: string, notePos: { x: number; y: number }) => void;
};

function anchorPct(
  ann: CanvasAnnotation,
  items: StudioItem[],
): { x: number; y: number; stale: boolean } {
  if (ann.anchor.kind === "point") {
    return { x: ann.anchor.x, y: ann.anchor.y, stale: false };
  }
  const itemId = ann.anchor.itemId;
  const item = items.find((i) => i.id === itemId);
  if (!item) return { x: ann.notePos.x, y: ann.notePos.y, stale: true };
  return { x: item.x, y: item.y, stale: false };
}

/**
 * Hand-lettered annotations + quadratic leaders (plan geometry / print).
 */
export function AnnotationLayer({
  annotations,
  items,
  selectedId,
  night,
  opacity,
  draft,
  technicalInk = false,
  onSelect,
  onMoveNote,
}: Props) {
  if (annotations.length === 0 || opacity <= 0.01) return null;
  const dim = (draft ? 0.5 : 1) * opacity;

  return (
    <div
      className={`${css.root}${technicalInk ? ` ${css.technicalInk}` : ""}`}
      data-testid="annotation-layer"
      data-ink={technicalInk ? "technical" : "hand"}
      style={{ opacity: dim }}
      aria-label="Notes"
    >
      <svg
        className={css.leaders}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {annotations.map((ann) => {
          const a = anchorPct(ann, items);
          const rand = seededRandom(`ann-lead:${ann.id}`);
          const c = wobbledLeaderControl(
            ann.notePos.x,
            ann.notePos.y,
            a.x,
            a.y,
            rand,
          );
          const stroke = technicalInk
            ? "var(--signal)"
            : night
              ? "var(--proposed-text)"
              : "var(--text-secondary)";
          return (
            <g key={`lead-${ann.id}`} data-testid="annotation-leader">
              <path
                d={`M ${ann.notePos.x} ${ann.notePos.y} Q ${c.cx} ${c.cy} ${a.x} ${a.y}`}
                fill="none"
                stroke={stroke}
                strokeWidth={0.4}
                strokeDasharray={a.stale ? "2 2" : undefined}
                vectorEffect="non-scaling-stroke"
              />
              {/* Open arrowhead at anchor */}
              <polygon
                points={`${a.x},${a.y} ${a.x - 0.9},${a.y - 1.4} ${a.x + 0.9},${a.y - 1.4}`}
                fill="none"
                stroke={stroke}
                strokeWidth={0.35}
                transform={`rotate(${(Math.atan2(a.y - c.cy, a.x - c.cx) * 180) / Math.PI} ${a.x} ${a.y})`}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          );
        })}
      </svg>
      {annotations.map((ann) => {
        const a = anchorPct(ann, items);
        return (
          <div
            key={ann.id}
            className={`${css.note}${selectedId === ann.id ? ` ${css.noteSelected}` : ""}${night ? ` ${css.noteNight}` : ""}`}
            data-testid="annotation-note"
            data-annotation-id={ann.id}
            style={{ left: `${ann.notePos.x}%`, top: `${ann.notePos.y}%` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(ann.id);
              const startX = e.clientX;
              const startY = e.clientY;
              const orig = { ...ann.notePos };
              const board = (e.currentTarget.parentElement as HTMLElement)
                ?.getBoundingClientRect();
              if (!board) return;
              const move = (ev: PointerEvent) => {
                const dx = ((ev.clientX - startX) / board.width) * 100;
                const dy = ((ev.clientY - startY) / board.height) * 100;
                onMoveNote(ann.id, {
                  x: Math.min(96, Math.max(4, orig.x + dx)),
                  y: Math.min(96, Math.max(4, orig.y + dy)),
                });
              };
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          >
            <span className={css.hand}>{ann.text.toUpperCase()}</span>
            {a.stale ? (
              <span className={css.stale} data-testid="annotation-stale">
                ?
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
