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
import {
  KIT_HUB_ICONS,
  kitHubIconById,
  loadKitHubIconId,
  saveKitHubIconId,
  type KitHubIconId,
} from "./kitHubIcons";
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
 * Main design kit — vertical inventory stack only (no carousel inside).
 * Niche 180° tools live separately on NicheToolCarousel around selected objects.
 * Hub mark: click cycles garden tools (personalisation without an in-stack carousel).
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
  const [hubIconId, setHubIconId] = useState<KitHubIconId>("spade");
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverRef = useRef(false);

  useEffect(() => {
    setHubIconId(loadKitHubIconId());
  }, []);

  const hubIcon = kitHubIconById(hubIconId);

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

  const cycleHubIcon = () => {
    const idx = KIT_HUB_ICONS.findIndex((i) => i.id === hubIconId);
    const next = KIT_HUB_ICONS[(idx + 1) % KIT_HUB_ICONS.length]!;
    setHubIconId(next.id);
    saveKitHubIconId(next.id);
    playInstrumentTick("step");
    stayEngaged();
  };

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
    >
      <p className={css.kicker}>
        {variant === "paint" ? "Paint loadout" : "Design kit"}
      </p>

      <div className={css.hubRow}>
        <button
          type="button"
          className={css.hub}
          data-testid={`${testId}-hub`}
          title={`${hubIcon.label} · click to change mark`}
          aria-label={`Kit mark · ${hubIcon.label}. Click to cycle garden tools`}
          onClick={cycleHubIcon}
        >
          <span className={css.hubGlyph} aria-hidden>
            {hubIcon.glyph}
          </span>
        </button>

        <div className={css.equipped} data-testid={`${testId}-equipped`}>
          <div className={css.equippedSlot} aria-hidden>
            {equippedType ? (
              <span className={css.glyph}>
                <StudioGlyph type={equippedType} ink />
              </span>
            ) : (
              <span className={css.equippedEmpty}>◇</span>
            )}
          </div>
          <div className={css.equippedMeta}>
            <p className={css.equippedName}>
              {equippedType ? BY_TYPE[equippedType].tag : "Select"}
            </p>
            <p className={css.equippedHint}>
              Hover to skim · click to keep
            </p>
          </div>
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
          const skim = inspectHover === t && !on;
          const hotkey = i < 9 ? String(i + 1) : null;
          return (
            <button
              key={t}
              type="button"
              role="option"
              aria-selected={on}
              className={`${css.slot}${on ? ` ${css.slotOn}` : ""}${skim ? ` ${css.slotSkim}` : ""}`}
              data-testid={`${slotTestIdPrefix}${t}`}
              title={`${BY_TYPE[t].name}${hotkey ? ` · ${hotkey}` : ""} · hover to skim, click to keep`}
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
              {inspectHover && equippedType && inspectHover !== equippedType
                ? " · click to keep"
                : ""}
            </p>
          </>
        ) : (
          <p className={css.inspectDetail}>Hover to skim · click to keep</p>
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
