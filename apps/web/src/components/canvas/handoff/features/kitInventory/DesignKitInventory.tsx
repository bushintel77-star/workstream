"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
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
import css from "./designKitInventory.module.css";

type Props = {
  /** Add kit = place loadout; paint kit = fill materials. */
  variant: "add" | "paint";
  types: StudioItemType[];
  equipped: StudioItemType | null;
  onEquip: (t: StudioItemType) => void;
  /** Bottom-centre dock (Add) vs floating near work (Paint). */
  placement?: "dock" | "anchor";
  style?: CSSProperties;
  testId: string;
  /** Slot test id prefix — add uses add-symbol-*, paint uses paint-swatch-*. */
  slotTestIdPrefix: string;
  sunHint?: string | null;
  footer?: ReactNode;
};

/**
 * Design kit inventory — WoW/Diablo slot logic applied to studio materials.
 * Bags filter, equipped frame, hover inspect, 1–9 quick-equip (parent hotkeys).
 */
export function DesignKitInventory({
  variant,
  types,
  equipped,
  onEquip,
  placement = "dock",
  style,
  testId,
  slotTestIdPrefix,
  sunHint,
  footer,
}: Props) {
  const [bag, setBag] = useState<KitBagId>("all");
  const [hover, setHover] = useState<StudioItemType | null>(null);

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
  const inspect = hover ?? equippedType;
  const inspectDef = inspect ? BY_TYPE[inspect] : null;

  return (
    <aside
      className={`${css.root} ${placement === "dock" ? css.docked : css.anchored}`}
      data-testid={testId}
      data-kit-variant={variant}
      style={style}
      aria-label={variant === "paint" ? "Paint materials kit" : "Design kit"}
    >
      <div className={css.head}>
        <p className={css.kicker}>
          {variant === "paint" ? "Paint loadout" : "Design kit"}
        </p>
        <p className={css.equippedLabel}>
          {equippedType ? `Equipped · ${BY_TYPE[equippedType].tag}` : "Nothing equipped"}
        </p>
      </div>

      <div className={css.equippedRow} data-testid={`${testId}-equipped`}>
        <div className={css.equippedSlot} aria-hidden>
          {equippedType ? (
            <span className={css.glyph}>
              <StudioGlyph type={equippedType} ink />
            </span>
          ) : null}
        </div>
        <div className={css.equippedMeta}>
          <p className={css.equippedName}>
            {equippedType ? BY_TYPE[equippedType].name : "Select a slot"}
          </p>
          <p className={css.equippedHint}>
            {variant === "paint"
              ? "Click a shape on the plan to fill"
              : "Click the lot to place · keys 1–9 quick-equip"}
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
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={css.grid} role="listbox" aria-label="Kit slots">
        {visible.map((t, i) => {
          const on = equippedType === t;
          const hot = i < 9 ? String(i + 1) : null;
          return (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={on}
              className={`${css.slot}${on ? ` ${css.slotOn}` : ""}`}
              data-testid={`${slotTestIdPrefix}${t}`}
              title={`${BY_TYPE[t].name}${hot ? ` · ${hot}` : ""}`}
              onMouseEnter={() => setHover(t)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(t)}
              onBlur={() => setHover(null)}
              onClick={() => {
                playInstrumentTick("arm");
                onEquip(t);
              }}
            >
              {hot ? <span className={css.hotkey}>{hot}</span> : null}
              <span className={css.glyph}>
                <StudioGlyph type={t} ink />
              </span>
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
                : `Indicative · from $${inspectDef.rate}`}
              {hover && equippedType && hover !== equippedType
                ? " · click to equip"
                : ""}
            </p>
          </>
        ) : (
          <p className={css.inspectDetail}>Hover a slot to inspect</p>
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
