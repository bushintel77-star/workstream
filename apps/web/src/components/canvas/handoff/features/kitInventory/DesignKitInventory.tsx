"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BY_TYPE,
  KIT_BAGS,
  type KitBagId,
  type StudioItemType,
} from "../../studioCatalog";
import { StudioGlyph } from "../../StudioGlyph";
import { playInstrumentTick } from "../ambient/instrumentTick";
import {
  ATELIER_LINGER_MS,
  type AtelierPhase,
} from "./atelierPresence";
import css from "./designKitInventory.module.css";

type Props = {
  /** Add kit = place loadout; paint kit = fill materials. */
  variant: "add" | "paint";
  types: StudioItemType[];
  equipped: StudioItemType | null;
  onEquip: (t: StudioItemType) => void;
  testId: string;
  /** Slot test id prefix — add uses add-symbol-*, paint uses paint-swatch-*. */
  slotTestIdPrefix: string;
  sunHint?: string | null;
  footer?: ReactNode;
};

/**
 * Main design kit — vertical stack in the left gutter (off the drawing).
 * Atelier presence: ease in, hold after leave, slowly settle to rest.
 */
export function DesignKitInventory({
  variant,
  types,
  equipped,
  onEquip,
  testId,
  slotTestIdPrefix,
  sunHint,
  footer,
}: Props) {
  const [bag, setBag] = useState<KitBagId>("all");
  const [hover, setHover] = useState(false);
  const [lingering, setLingering] = useState(true);
  const [inspectHover, setInspectHover] = useState<StudioItemType | null>(null);
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverRef = useRef(false);

  const bags = useMemo(() => {
    return [
      {
        id: "all" as const,
        label: "All",
        types: types as readonly StudioItemType[],
      },
      ...KIT_BAGS.filter((b) => b.types.some((t) => types.includes(t))),
    ];
  }, [types]);

  useEffect(() => {
    if (bag !== "all" && !bags.some((b) => b.id === bag)) {
      setBag("all");
    }
  }, [bag, bags]);

  const visible = useMemo(() => {
    if (bag === "all") return types;
    const bagTypes = KIT_BAGS.find((b) => b.id === bag)?.types ?? [];
    return types.filter((t) => bagTypes.includes(t));
  }, [bag, types]);

  const equippedType = equipped && types.includes(equipped) ? equipped : null;
  const inspect = inspectHover ?? equippedType;
  const inspectDef = inspect ? BY_TYPE[inspect] : null;

  const clearLinger = useCallback(() => {
    if (lingerTimer.current) {
      clearTimeout(lingerTimer.current);
      lingerTimer.current = null;
    }
  }, []);

  /** After disengage — hold readable, then settle to rest (no snap). */
  const beginLinger = useCallback(() => {
    clearLinger();
    setLingering(true);
    lingerTimer.current = setTimeout(() => {
      setLingering(false);
      lingerTimer.current = null;
    }, ATELIER_LINGER_MS);
  }, [clearLinger]);

  const stayEngaged = useCallback(() => {
    clearLinger();
    setLingering(true);
  }, [clearLinger]);

  // Mode / equip change: wake to linger (not a combat snap), then hold.
  useEffect(() => {
    if (hoverRef.current) {
      stayEngaged();
      return clearLinger;
    }
    beginLinger();
    return clearLinger;
  }, [equippedType, variant, beginLinger, stayEngaged, clearLinger]);

  const phase: AtelierPhase = hover
    ? "open"
    : lingering
      ? "linger"
      : "rest";

  const cycle = useCallback(
    (dir: 1 | -1) => {
      if (visible.length === 0) return;
      const cur = equippedType ? visible.indexOf(equippedType) : -1;
      const base = cur >= 0 ? cur : 0;
      const next = (base + dir + visible.length) % visible.length;
      const pick = visible[next];
      if (!pick) return;
      playInstrumentTick("step");
      onEquip(pick);
      if (!hoverRef.current) beginLinger();
      else stayEngaged();
    },
    [visible, equippedType, onEquip, beginLinger, stayEngaged],
  );

  return (
    <aside
      className={css.root}
      data-testid={testId}
      data-kit-variant={variant}
      data-phase={phase}
      aria-label={variant === "paint" ? "Paint materials kit" : "Design kit"}
      onMouseEnter={() => {
        hoverRef.current = true;
        stayEngaged();
        setHover(true);
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
        setHover(false);
        setInspectHover(null);
        beginLinger();
      }}
      onWheel={(e) => {
        if (Math.abs(e.deltaY) < 2) return;
        e.preventDefault();
        cycle(e.deltaY > 0 ? 1 : -1);
      }}
    >
      <p className={css.kicker}>
        {variant === "paint" ? "Paint loadout" : "Design kit"}
      </p>

      <div className={css.equipped} data-testid={`${testId}-equipped`}>
        <div className={css.equippedSlot} aria-hidden>
          {equippedType ? (
            <span className={css.glyph}>
              <StudioGlyph type={equippedType} ink />
            </span>
          ) : null}
        </div>
        <div className={css.equippedMeta}>
          <p className={css.equippedName}>
            {equippedType ? BY_TYPE[equippedType].tag : "Select"}
          </p>
          <p className={css.equippedHint}>
            {variant === "paint" ? "Click shape to fill" : "Click lot to place"}
          </p>
        </div>
      </div>

      {bags.length > 2 ? (
        <div className={css.bags} role="tablist" aria-label="Kit bags">
          {bags.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={bag === b.id}
              className={`${css.bag}${bag === b.id ? ` ${css.bagOn}` : ""}`}
              data-testid={`kit-bag-${b.id}`}
              onClick={() => {
                setBag(b.id);
                playInstrumentTick("step");
                if (!hoverRef.current) beginLinger();
                else stayEngaged();
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={css.stack} role="listbox" aria-label="Kit slots">
        {visible.map((t, i) => {
          const on = equippedType === t;
          const hotkey = i < 9 ? String(i + 1) : null;
          return (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={on}
              className={`${css.slot}${on ? ` ${css.slotOn}` : ""}`}
              data-testid={`${slotTestIdPrefix}${t}`}
              title={`${BY_TYPE[t].name}${hotkey ? ` · ${hotkey}` : ""}`}
              onMouseEnter={() => setInspectHover(t)}
              onMouseLeave={() => setInspectHover(null)}
              onFocus={() => setInspectHover(t)}
              onBlur={() => setInspectHover(null)}
              onClick={() => {
                playInstrumentTick("arm");
                onEquip(t);
                if (!hoverRef.current) beginLinger();
                else stayEngaged();
              }}
            >
              {hotkey ? <span className={css.hotkey}>{hotkey}</span> : null}
              <span className={css.glyph}>
                <StudioGlyph type={t} ink />
              </span>
              <span className={css.slotLabel}>{BY_TYPE[t].tag}</span>
            </button>
          );
        })}
      </div>

      <div className={css.inspect} data-testid={`${testId}-inspect`}>
        {inspectDef ? (
          <>
            <p className={css.inspectName}>{inspectDef.name}</p>
            <p className={css.inspectDetail}>
              {inspectDef.existing
                ? "Survey mark · set DBH when placing"
                : `Proposed · from $${inspectDef.rate}`}
            </p>
          </>
        ) : (
          <p className={css.inspectDetail}>Scroll · keys 1–9</p>
        )}
      </div>

      {(sunHint || footer) && (
        <div className={css.footer}>
          {sunHint ? (
            <p className={css.hint} data-testid="add-sun-probe-hint">
              {sunHint}
            </p>
          ) : null}
          {footer}
        </div>
      )}
    </aside>
  );
}

/** Ordered types currently shown in the active bag — for 1–9 hotkeys. */
export function kitVisibleTypes(
  types: StudioItemType[],
  bag: KitBagId = "all",
): StudioItemType[] {
  if (bag === "all") return types;
  const bagTypes = KIT_BAGS.find((b) => b.id === bag)?.types ?? [];
  return types.filter((t) => bagTypes.includes(t));
}
