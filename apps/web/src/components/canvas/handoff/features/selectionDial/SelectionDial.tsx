"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { CameraChrome } from "../../CameraChrome";
import type { BoardCamera } from "../../geometry/cameraPointer";
import {
  BY_TYPE,
  KIT_BAGS,
  type StudioItem,
  type StudioItemType,
} from "../../studioCatalog";
import {
  SpeciesSymbol,
  isSpeciesSymbolType,
} from "../render/symbols/SpeciesSymbol";
import {
  dialArcAngles,
  dialOffsetPx,
  emptiestDialSide,
  snapRotDetent,
} from "./dialMath";
import css from "./selectionDial.module.css";

const RADIUS = 108;
const SLOT_R = 20;

type SlotId =
  | "rotate"
  | "scale"
  | "swap"
  | "duplicate"
  | "annotate"
  | "delete";

type Props = {
  item: StudioItem;
  items: StudioItem[];
  cam: BoardCamera;
  night?: boolean;
  onTransform: (
    id: string,
    patch: Partial<Pick<StudioItem, "rot" | "scale">>,
  ) => void;
  onChangeType: (t: StudioItemType) => void;
  onDuplicate: () => void;
  onAnnotate: () => void;
  onDelete: () => void;
  onDismiss: () => void;
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/**
 * Selection dial — 180° steering-wheel arc around one item.
 * CameraChrome project placement; never under zoom-world.
 */
export function SelectionDial({
  item,
  items,
  cam,
  night = false,
  onTransform,
  onChangeType,
  onDuplicate,
  onAnnotate,
  onDelete,
  onDismiss,
}: Props) {
  const [openSwap, setOpenSwap] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const dragRef = useRef<
    | { kind: "rotate"; startAngle: number; rot0: number }
    | { kind: "scale"; startDist: number; scale0: number }
    | null
  >(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const side = useMemo(
    () => emptiestDialSide({ x: item.x, y: item.y }, items, item.id),
    [item.x, item.y, item.id, items],
  );
  const { ox, oy } = dialOffsetPx(side, RADIUS);
  const { startDeg, sweepDeg } = dialArcAngles(side);

  const slots: Array<{ id: SlotId; label: string }> = [
    { id: "rotate", label: "Rotate" },
    { id: "scale", label: "Scale" },
    { id: "swap", label: "Species" },
    { id: "duplicate", label: "Duplicate" },
    { id: "annotate", label: "Annotate" },
    { id: "delete", label: "Delete" },
  ];

  const familyTypes = useMemo(() => {
    const bag = KIT_BAGS.find((b) => b.types.includes(item.t));
    const types = (bag?.types ?? [item.t]).filter(
      (t) => t !== "frenchdrain" || item.t === "frenchdrain",
    );
    return types as StudioItemType[];
  }, [item.t]);

  const slotAngle = useCallback(
    (i: number) => {
      const n = Math.max(1, slots.length - 1);
      return startDeg + (sweepDeg * i) / n;
    },
    [slots.length, startDeg, sweepDeg],
  );

  const runSlot = useCallback(
    (id: SlotId) => {
      if (id === "swap") {
        setOpenSwap((v) => !v);
        return;
      }
      setOpenSwap(false);
      if (id === "duplicate") onDuplicate();
      else if (id === "annotate") onAnnotate();
      else if (id === "delete") onDelete();
    },
    [onAnnotate, onDelete, onDuplicate],
  );

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (openSwap) setOpenSwap(false);
      else onDismiss();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => (i + 1) % slots.length);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => (i - 1 + slots.length) % slots.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const id = slots[focusIdx]?.id;
      if (id) runSlot(id);
    }
  };

  return (
    <CameraChrome
      place={{
        kind: "project",
        pct: { x: item.x, y: item.y },
        cam,
        transform: `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`,
      }}
    >
      <div
        className={`${css.dial}${night ? ` ${css.dialNight}` : ""}${reducedMotion ? ` ${css.instant}` : ""}`}
        data-testid="selection-dial"
        role="menu"
        aria-label="Selection tools"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <svg
          className={css.arc}
          width={RADIUS * 2 + 48}
          height={RADIUS * 2 + 48}
          viewBox={`0 0 ${RADIUS * 2 + 48} ${RADIUS * 2 + 48}`}
          aria-hidden
        >
          <path
            d={arcPath(
              RADIUS + 24,
              RADIUS + 24,
              RADIUS,
              startDeg,
              startDeg + sweepDeg,
            )}
            className={css.arcStroke}
            fill="none"
          />
        </svg>

        {slots.map((slot, i) => {
          const ang = slotAngle(i);
          const p = polar(RADIUS + 24, RADIUS + 24, RADIUS, ang);
          const focused = focusIdx === i;
          return (
            <button
              key={slot.id}
              type="button"
              role="menuitem"
              className={`${css.slot}${focused ? ` ${css.slotFocus}` : ""}${slot.id === "delete" ? ` ${css.slotDanger}` : ""}`}
              data-testid={`dial-slot-${slot.id}`}
              aria-label={slot.label}
              title={slot.label}
              style={
                {
                  left: p.x,
                  top: p.y,
                  width: SLOT_R * 2,
                  height: SLOT_R * 2,
                } as CSSProperties
              }
              onFocus={() => setFocusIdx(i)}
              onClick={() => runSlot(slot.id)}
              onPointerDown={(e) => {
                if (slot.id !== "rotate" && slot.id !== "scale") return;
                e.preventDefault();
                e.stopPropagation();
                (e.target as Element).setPointerCapture?.(e.pointerId);
                const board = document.querySelector(
                  '[data-testid="studio-board"]',
                ) as HTMLElement | null;
                const rect = board?.getBoundingClientRect();
                if (!rect) return;
                if (slot.id === "rotate") {
                  const a0 =
                    (Math.atan2(
                      e.clientY - (rect.top + rect.height / 2),
                      e.clientX - (rect.left + rect.width / 2),
                    ) *
                      180) /
                    Math.PI;
                  dragRef.current = {
                    kind: "rotate",
                    startAngle: a0,
                    rot0: item.rot,
                  };
                } else {
                  const cx = rect.left + (item.x / 100) * rect.width;
                  const cy = rect.top + (item.y / 100) * rect.height;
                  // Approximate with dial centre offset
                  const dx = e.clientX - (cx + ox);
                  const dy = e.clientY - (cy + oy);
                  dragRef.current = {
                    kind: "scale",
                    startDist: Math.hypot(dx, dy) || 1,
                    scale0: item.scale,
                  };
                }
              }}
              onPointerMove={(e) => {
                const d = dragRef.current;
                if (!d) return;
                const board = document.querySelector(
                  '[data-testid="studio-board"]',
                ) as HTMLElement | null;
                const rect = board?.getBoundingClientRect();
                if (!rect) return;
                if (d.kind === "rotate") {
                  const a =
                    (Math.atan2(
                      e.clientY - (rect.top + rect.height / 2),
                      e.clientX - (rect.left + rect.width / 2),
                    ) *
                      180) /
                    Math.PI;
                  const delta = a - d.startAngle;
                  const soft = snapRotDetent(d.rot0 + delta, 15);
                  // Free between detents while dragging; soft snap shown.
                  const free = d.rot0 + delta;
                  const mix =
                    Math.abs(free - soft) < 4 ? soft : free;
                  onTransform(item.id, { rot: mix });
                } else {
                  const cx = rect.left + (item.x / 100) * rect.width;
                  const cy = rect.top + (item.y / 100) * rect.height;
                  const dx = e.clientX - (cx + ox);
                  const dy = e.clientY - (cy + oy);
                  const dist = Math.hypot(dx, dy) || 1;
                  const next = Math.max(
                    0.35,
                    Math.min(2.5, d.scale0 * (dist / d.startDist)),
                  );
                  onTransform(item.id, { scale: next });
                }
              }}
              onPointerUp={() => {
                const d = dragRef.current;
                if (d?.kind === "rotate") {
                  onTransform(item.id, {
                    rot: snapRotDetent(item.rot, 15),
                  });
                }
                dragRef.current = null;
              }}
            >
              <span className={css.slotGlyph} aria-hidden>
                {slotGlyph(slot.id)}
              </span>
              <span className={css.slotCap}>{slot.label}</span>
            </button>
          );
        })}

        {openSwap ? (
          <div
            className={css.swapRail}
            data-testid="dial-species-swap"
            role="listbox"
            aria-label="Species swatches"
          >
            {familyTypes.map((t) => {
              const def = BY_TYPE[t];
              const on = t === item.t;
              return (
                <button
                  key={t}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`${css.swatch}${on ? ` ${css.swatchOn}` : ""}`}
                  data-testid={`dial-swatch-${t}`}
                  title={def.name}
                  onClick={() => {
                    onChangeType(t);
                    setOpenSwap(false);
                  }}
                >
                  <span className={css.swatchSym} aria-hidden>
                    {isSpeciesSymbolType(t) ? (
                      <svg viewBox="0 0 100 100" width="28" height="28">
                        <SpeciesSymbol
                          type={t}
                          itemId={`dial-swatch-${t}`}
                          night={Boolean(night)}
                          ghost={false}
                          ink={!night}
                          label={def.name}
                        />
                      </svg>
                    ) : (
                      <span className={css.swatchWash} data-type={t} />
                    )}
                  </span>
                  <span className={css.swatchName}>{def.name}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </CameraChrome>
  );
}

function slotGlyph(id: SlotId): string {
  switch (id) {
    case "rotate":
      return "↻";
    case "scale":
      return "⤢";
    case "swap":
      return "⇄";
    case "duplicate":
      return "⧉";
    case "annotate":
      return "✎";
    case "delete":
      return "×";
  }
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg >= startDeg ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} ${sweep} ${e.x} ${e.y}`;
}
