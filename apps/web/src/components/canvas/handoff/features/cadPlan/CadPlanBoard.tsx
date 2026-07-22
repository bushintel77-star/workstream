"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildOutsideDims,
  deleteVertex,
  edgeSegments,
  insertVertexAfter,
  pointInPolygon,
  polygonAreaM2,
  projectPointOnSegment,
  GRID_INK_STROKE,
  GRID_STEP_PCT,
  ptsAttr,
  snapAlignment,
  snapToGridMetres,
  snapToNearby,
  snapVertexDrag,
  tpzRadiusPct,
  clientToBoardPct,
  type GridFormation,
  type GridGrain,
  type GridInk,
  type PctPoint,
} from "../../geometry";
import {
  formatCadAreaM2,
  formatCadBearing,
  formatCadMetres,
  neighbourLotContext,
  polygonCentroid,
} from "../../geometry/foundationCadContext";
import { planLinesFor } from "../../geometry/planLineStyles";
import { DraftGridMesh } from "../gridStudio/DraftGridMesh";
import {
  BY_TYPE,
  type StudioItem,
  type StudioItemType,
  type StudioMode,
  type StudioTool,
} from "../../studioCatalog";
import { StudioGlyph } from "../../StudioGlyph";
import {
  ITEM_LAYER,
  type LayerKey,
  type LayerOpacity,
} from "../../state/studioTypes";
import { resolveLayerVisual } from "../../state/layerIsolate";
import { airLockSnapToHardscape } from "../pointer/airLockSnap";
import { describeSelectedItem } from "../liveMeasures/describeSelectedItem";
import { BoardChromePortal } from "../../BoardChromePortal";
import { SelectionHandles } from "./SelectionHandles";
import css from "./cadPlan.module.css";

type NodeMenu = {
  kind: "boundary" | "building";
  index: number;
  x: number;
  y: number;
};

type ItemMenu = {
  id: string;
  t: StudioItemType;
  x: number;
  y: number;
};

type Props = {
  frameOn: boolean;
  darkOn: boolean;
  /** Stage 1 — charcoal title overlay + AI underlay. */
  foundationCleanse?: boolean;
  /** Vicmap-sourced title — solid charcoal stroke (not dashed ghost). */
  titleLocked?: boolean;
  /** Title CAD nodes locked (no drag). */
  titleBoundaryLocked?: boolean;
  /** Optional cadastral lot area (Vicmap) for centre CAD label. */
  lotAreaM2?: number | null;
  /** Live site-area calculation from the same schedule as the measure ledger. */
  siteAreas?: {
    buildingAreaM2: number;
    outdoorAreaM2: number;
  } | null;
  /** Street / site label for CAD annotation (not REA map chrome). */
  siteLabel?: string | null;
  /** Vicmap / title metadata for CAD edge callouts. */
  titleMeta?: {
    parcelRef?: string | null;
    sourceLabel?: string | null;
    councilLabel?: string | null;
    sourceKind?: string | null;
  } | null;
  boundary: PctPoint[];
  building: PctPoint[];
  /** Closed easement rings — hatched on plan (honesty layer). */
  easements?: PctPoint[][];
  /** Open service / utility corridors — dashed locate layer. */
  services?: PctPoint[][];
  items: StudioItem[];
  tool: StudioTool;
  /** Studio mode — survey shows edge dims; sketch disables pointer capture. */
  mode?: StudioMode;
  locked: boolean;
  layerOpacity: LayerOpacity;
  isolatedLayer?: LayerKey | null;
  setbackOn: boolean;
  /** Indicative council setback rule (m) — muted on-plan path label, not a card. */
  councilSetbackM?: number | null;
  growth: "plant" | "5yr" | "mature";
  selectedId: string | null;
  groupIds: string[];
  hoverId: string | null;
  curGhostId: string | null;
  /** When the review dock is open, suppress on-canvas Accept chrome. */
  reviewOpen?: boolean;
  /** Item ids currently failing preemptive council checks. */
  flaggedIds?: Set<string>;
  /** Live TPZ encroachment labels (calm compliance — inline, not modal). */
  tpzReadouts?: Array<{
    id: string;
    x: number;
    y: number;
    pct: number;
    active: boolean;
  }>;
  scaleM?: number;
  /** Camera zoom — for screen-px → world snap radius. */
  planZoom?: number;
  /** Free-plan camera (must match `.zoomWorld` transform). */
  planPanX?: number;
  planPanY?: number;
  planFocusX?: number;
  planFocusY?: number;
  planRotateDeg?: number;
  onSelect: (id: string | null, opts?: { additive?: boolean }) => void;
  onMarqueeSelect: (
    ids: string[],
    opts?: { additive?: boolean },
  ) => void;
  onHover: (id: string | null) => void;
  onAcceptGhost: (id: string) => void;
  onRejectGhost: (id: string) => void;
  onTraceInElevation: (id: string) => void;
  onBoundaryChange: (pts: PctPoint[]) => void;
  onBuildingChange: (pts: PctPoint[]) => void;
  onPlace: (x: number, y: number) => void;
  onMoveItem: (id: string, x: number, y: number) => void;
  onMoveGroup: (ids: string[], dx: number, dy: number) => void;
  onTransformItem: (
    id: string,
    patch: Partial<Pick<StudioItem, "rot" | "scale">>,
  ) => void;
  /** Magnetic drafting grid grain. */
  gridGrain?: GridGrain;
  gridSnap?: boolean;
  gridFormation?: GridFormation;
  gridInk?: GridInk;
  /** Paint bucket — recolor / retag a symbol. */
  onPaintItem?: (id: string) => void;
  /** Item id that just received a Paint apply — settle-flash confirmation. */
  paintFlashId?: string | null;
  /** Swatch/stamp currently hovered in the persistent tray — preview before commit. */
  previewSwatch?: StudioItemType | null;
  /** Eyedropper armed — clicking an element loads its style into the swatch. */
  eyedropArmed?: boolean;
  onEyedrop?: (t: StudioItemType) => void;
  /**
   * Empty-board click (not an item / CAD handle).
   * `insideLot` — true on the property drawing; false on the canvas margin.
   * Margin clicks summon instruments; lot clicks are for selection / clear.
   */
  onEmptyClick?: (hit: {
    x: number;
    y: number;
    insideLot: boolean;
  }) => void;
  /** Boundary / building handle interaction — dismiss instrument summon. */
  onCadHandleInteract?: () => void;
  /** Hover affordance on handles / insert nodes — drives context cursor. */
  onBoardCursor?: (mode: "default" | "move" | "add" | "paint") => void;
};

function growthFactor(stage: "plant" | "5yr" | "mature", existing: boolean) {
  if (existing) return 1;
  if (stage === "plant") return 0.45;
  if (stage === "5yr") return 0.75;
  return 1;
}

/**
 * Plan drawing board — polys, symbols, edit handles, dims, TPZ.
 * Ground/aerial owned by AerialSlot + TactileGround (no plate/scrim here).
 */
export function CadPlanBoard({
  frameOn,
  darkOn,
  foundationCleanse = false,
  titleLocked = false,
  titleBoundaryLocked = false,
  lotAreaM2 = null,
  siteAreas = null,
  siteLabel = null,
  titleMeta = null,
  boundary,
  building,
  easements = [],
  services = [],
  items,
  tool,
  mode = "cad",
  locked,
  layerOpacity,
  isolatedLayer = null,
  setbackOn,
  councilSetbackM = null,
  growth,
  selectedId,
  groupIds,
  hoverId,
  curGhostId,
  reviewOpen = false,
  flaggedIds,
  tpzReadouts,
  scaleM = 110,
  planZoom = 1,
  planPanX = 0,
  planPanY = 0,
  planFocusX = 50,
  planFocusY = 50,
  planRotateDeg = 0,
  onSelect,
  onMarqueeSelect,
  onHover,
  onAcceptGhost,
  onRejectGhost,
  onTraceInElevation,
  onBoundaryChange,
  onBuildingChange,
  onPlace,
  onMoveItem,
  onMoveGroup,
  onTransformItem,
  gridGrain = "medium",
  gridSnap = true,
  gridFormation = "ortho",
  gridInk = "charcoal",
  onPaintItem,
  paintFlashId = null,
  previewSwatch = null,
  eyedropArmed = false,
  onEyedrop,
  onEmptyClick,
  onCadHandleInteract,
  onBoardCursor,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    kind: "item" | "boundary" | "building" | "marquee" | "group";
    id?: string;
    index?: number;
    ox?: number;
    oy?: number;
    ids?: string[];
    startX?: number;
    startY?: number;
    /** Shift-marquee unions into the current selection. */
    additive?: boolean;
  } | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });
  const [marquee, setMarquee] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [crosshair, setCrosshair] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [nodeMenu, setNodeMenu] = useState<NodeMenu | null>(null);
  const [itemMenu, setItemMenu] = useState<ItemMenu | null>(null);
  const [hoverEdge, setHoverEdge] = useState<{
    kind: "boundary" | "building";
    index: number;
  } | null>(null);
  const [nodeFlash, setNodeFlash] = useState<{
    kind: "boundary" | "building";
    index: number;
  } | null>(null);
  const [cursorPct, setCursorPct] = useState<PctPoint | null>(null);
  /** Why the pointer snapped — surfaced as a glyph legend, not just a flash. */
  const [snapKind, setSnapKind] = useState<
    "grid" | "align" | "vertex" | "ortho" | null
  >(null);
  const [cursorMode, setCursorMode] = useState<"default" | "move" | "add">(
    "default",
  );
  useEffect(() => {
    if (!onBoardCursor) return;
    if (tool === "paint") {
      onBoardCursor("paint");
      return;
    }
    onBoardCursor(cursorMode);
  }, [cursorMode, tool, onBoardCursor]);
  const gridStep = GRID_STEP_PCT[gridGrain];
  const showDraftGrid =
    !frameOn &&
    !foundationCleanse &&
    (tool === "edit" || tool === "paint" || tool === "add" || tool === "pan");

  /** Title CAD drag when Stage 1 unlocked — snap via snapVertexDrag. */
  const titleEditing =
    foundationCleanse && !titleBoundaryLocked && !frameOn;
  const editing =
    (tool === "edit" && !locked && !frameOn && !foundationCleanse) ||
    (titleEditing && tool === "edit");
  const titleSolid = foundationCleanse || titleLocked;
  const sketchPassthrough = mode === "sketch";
  /** Survey annotation tools own the pointer (prototype Level / Servc / Calib). */
  const surveyAnnotatePassthrough =
    mode === "survey" &&
    (tool === "calib" || tool === "level" || tool === "service");
  /** Zone tool owns the pointer for authored drip / lighting paths. */
  const zonePassthrough = tool === "zone";
  const boardPassthrough =
    sketchPassthrough || surveyAnnotatePassthrough || zonePassthrough;
  const cadTitleMode = foundationCleanse || titleLocked;
  /** Fit sheet: classic dashed boundary + solid footprint (screenshot language). */
  const fitSheetStroke = frameOn;
  const lines = planLinesFor({
    darkOn,
    titleSolid,
    fitSheet: fitSheetStroke,
  });
  const bStroke = lines.boundary.stroke;
  const bldStroke = lines.building.stroke;
  const bldFill = lines.building.fill ?? "transparent";

  /** Fit sheet working drawing: B + F. Stage 1 plate alone: B only. */
  const boundarySegs = edgeSegments(boundary, "B", scaleM);
  const buildingSegs = edgeSegments(building, "F", scaleM);
  /*
   * Progressive disclosure: the full dimension ring is a working-drawing detail,
   * not idle chrome. Show it while editing, in the Fit sheet, in Stage 1 title
   * mode, or in Survey — but let idle CAD (even a Vicmap-locked title) stay a
   * calm drawing. Dims return in <=1 interaction (arm Edit / open Fit sheet).
   */
  const showDims =
    !sketchPassthrough &&
    (editing || frameOn || foundationCleanse || mode === "survey");
  const contextLots =
    cadTitleMode && !frameOn ? neighbourLotContext(boundary) : [];
  const titleCentroid = polygonCentroid(boundary);
  const buildingCentroid =
    building.length >= 3 ? polygonCentroid(building) : null;
  const drawnLotM2 = polygonAreaM2(boundary, scaleM);
  const areaLabelM2 =
    lotAreaM2 != null && lotAreaM2 > 5 ? lotAreaM2 : drawnLotM2;
  const buildingAreaLabelM2 =
    siteAreas?.buildingAreaM2 ??
    (building.length >= 3 ? polygonAreaM2(building, scaleM) : 0);
  const outdoorAreaLabelM2 = siteAreas?.outdoorAreaM2 ?? 0;
  const showAutoAreaLabels =
    !frameOn &&
    !sketchPassthrough &&
    (mode === "survey" || mode === "cad");
  /**
   * Existing dwelling shown as a plain envelope. Label its centroid — but only
   * when the richer "Existing dwelling · <area>" auto label isn't already
   * there (survey/CAD), otherwise the two labels stack and collide.
   */
  const buildingAreaLabelShown =
    showAutoAreaLabels && buildingCentroid != null && buildingAreaLabelM2 > 0;
  const showHouseEnvelopeLabel =
    buildingCentroid != null &&
    !sketchPassthrough &&
    !foundationCleanse &&
    !buildingAreaLabelShown;
  /**
   * Always park dimensions outside the polygon — never a chip on the line.
   * Fit sheet uses tighter offsets; live CAD uses a slightly wider stand-off.
   */
  const outsideDims = showDims
    ? [
        ...buildOutsideDims(boundarySegs, boundary, {
          offsetPct: frameOn ? 1.6 : 2.4,
          labelExtraPct: frameOn ? 1.0 : 1.55,
          tickPct: frameOn ? 0.9 : 1.05,
        }),
        ...(building.length >= 3 && !foundationCleanse
          ? buildOutsideDims(buildingSegs, building, {
              offsetPct: frameOn ? 1.2 : 1.9,
              labelExtraPct: frameOn ? 0.85 : 1.25,
              tickPct: frameOn ? 0.8 : 0.95,
            })
          : []),
      ]
    : [];

  const existTrees = items.filter((i) => i.t === "exist" && !i.ghost);
  /** Sketch pad strips CAD glyphs — site geometry stays as a faint guide. */
  const planItems = sketchPassthrough ? [] : items;
  const underlayOp = foundationCleanse ? 0.38 : 1;
  const existTpz = existTrees.map((it) => {
    const dbhM = it.dbhM ?? BY_TYPE.exist.dbhM ?? 0.45;
    return { it, dbhM, tpz: tpzRadiusPct(dbhM, scaleM) };
  });

  const toPct = useCallback(
    (clientX: number, clientY: number) => {
      const el = rootRef.current;
      if (!el) return { x: 50, y: 50 };
      const board =
        (el.closest('[data-testid="studio-board"]') as HTMLElement | null) ??
        el;
      const boardRect = board.getBoundingClientRect();
      return clientToBoardPct(clientX, clientY, boardRect, {
        boardW: el.clientWidth || 960,
        boardH: el.clientHeight || 640,
        zoom: planZoom,
        rotateDeg: planRotateDeg,
        panX: planPanX,
        panY: planPanY,
        focusX: planFocusX,
        focusY: planFocusY,
      });
    },
    [planZoom, planRotateDeg, planPanX, planPanY, planFocusX, planFocusY],
  );

  /** Layout px of the plan root (untransformed) — never the rotated AABB. */
  const boardLayout = () => {
    const el = rootRef.current;
    return {
      w: el?.clientWidth || 960,
      h: el?.clientHeight || 640,
    };
  };

  const onPointerDownBoard = (e: React.PointerEvent) => {
    if (tool === "add" || tool === "paint") {
      const raw = toPct(e.clientX, e.clientY);
      const el = rootRef.current;
      const boardW = el?.clientWidth ?? 960;
      const boardH = el?.clientHeight ?? 640;
      const locked = airLockSnapToHardscape(
        raw,
        [boundary, building],
        boardW,
        boardH,
      );
      const peers = items
        .filter((i) => !i.ghost)
        .map((i) => ({ x: i.x, y: i.y }));
      const p = gridSnap
        ? snapToNearby(locked, peers, {
            planZoom,
            boardW,
            boardH,
            scaleM,
          })
        : locked;
      onPlace(p.x, p.y);
      return;
    }
    if (tool === "edit" || tool === "pan") {
      const p = toPct(e.clientX, e.clientY);
      dragRef.current = {
        kind: "marquee",
        startX: p.x,
        startY: p.y,
        ox: p.x,
        oy: p.y,
        additive: e.shiftKey || e.metaKey,
      };
      setMarquee({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
  };

  const toolLabel =
    eyedropArmed
      ? "Pick"
      : tool === "paint"
        ? "Fill"
        : tool === "add"
          ? "Place"
          : tool === "measure"
            ? "Measure"
            : tool === "edit"
              ? "Edit"
              : tool === "pan"
                ? "Pan"
                : tool;
  const startCornerDrag = (
    kind: "boundary" | "building",
    index: number,
    e: React.PointerEvent,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setNodeMenu(null);
    onCadHandleInteract?.();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { kind, index, ox: 0, oy: 0 };
  };

  const openNodeMenu = (
    kind: "boundary" | "building",
    index: number,
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const pts = kind === "boundary" ? boundary : building;
    const p = pts[index];
    if (!p) return;
    setNodeMenu({ kind, index, x: p.x, y: p.y });
  };

  const removeNode = (kind: "boundary" | "building", index: number) => {
    const pts = kind === "boundary" ? boundary : building;
    const next = deleteVertex(pts, index);
    if (!next) {
      setNodeFlash({ kind, index });
      window.setTimeout(() => setNodeFlash(null), 220);
      return;
    }
    if (kind === "boundary") onBoundaryChange(next);
    else onBuildingChange(next);
    setNodeMenu(null);
  };

  const insertProjected = (
    kind: "boundary" | "building",
    after: number,
    event: React.MouseEvent<SVGLineElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const pts = kind === "boundary" ? boundary : building;
    const a = pts[after];
    const b = pts[(after + 1) % pts.length];
    const root = rootRef.current;
    if (!a || !b || !root) return;
    const projected = projectPointOnSegment(
      toPct(event.clientX, event.clientY),
      a,
      b,
      root.clientWidth || 960,
      root.clientHeight || 640,
    );
    const next = insertVertexAfter(pts, after, projected);
    if (kind === "boundary") onBoundaryChange(next);
    else onBuildingChange(next);
    setHoverEdge(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    setCursorPct(toPct(e.clientX, e.clientY));
    const d = dragRef.current;
    if (!d) return;
    const p = toPct(e.clientX, e.clientY);
    if (d.kind === "marquee" && d.startX != null && d.startY != null) {
      setMarquee({ x1: d.startX, y1: d.startY, x2: p.x, y2: p.y });
      return;
    }
    if (d.kind === "group" && d.ids && d.startX != null && d.startY != null) {
      const { w: boardW, h: boardH } = boardLayout();
      const peers = items
        .filter((i) => !i.ghost && !d.ids!.includes(i.id))
        .map((i) => ({ x: i.x, y: i.y }));
      const snapped = gridSnap
        ? snapToNearby(p, peers, { planZoom, boardW, boardH, scaleM })
        : p;
      const dx = snapped.x - d.startX;
      const dy = snapped.y - d.startY;
      dragRef.current = { ...d, startX: snapped.x, startY: snapped.y };
      setCrosshair({ x: snapped.x, y: snapped.y });
      onMoveGroup(d.ids, dx, dy);
      return;
    }
    if (d.kind === "item" && d.id) {
      const others = items
        .filter((o) => o.id !== d.id)
        .map((o) => ({ x: o.x, y: o.y }));
      const { w: boardW, h: boardH } = boardLayout();
      if (gridSnap) {
        const point = snapToNearby(p, others, {
          planZoom,
          boardW,
          boardH,
          scaleM,
        });
        const align = snapAlignment(point, others);
        setGuides({ x: align.guideX, y: align.guideY });
        setCrosshair({ x: align.point.x, y: align.point.y });
        setSnapKind(
          align.guideX != null || align.guideY != null ? "align" : "grid",
        );
        onMoveItem(d.id, align.point.x, align.point.y);
      } else {
        const snapped = snapAlignment(p, others);
        setGuides({ x: snapped.guideX, y: snapped.guideY });
        setCrosshair({ x: snapped.point.x, y: snapped.point.y });
        setSnapKind(
          snapped.guideX != null || snapped.guideY != null ? "align" : null,
        );
        onMoveItem(d.id, snapped.point.x, snapped.point.y);
      }
      return;
    }
    if (
      (d.kind === "boundary" || d.kind === "building") &&
      d.index != null
    ) {
      const pts = d.kind === "boundary" ? boundary : building;
      const exclude = pts[d.index];
      const { w: boardW, h: boardH } = boardLayout();
      const snapped = snapVertexDrag(p, [...boundary, ...building], {
        boardW,
        boardH,
        exclude,
        vertexPx: 12,
        shift: e.shiftKey,
      });
      const next = pts.map((pt, i) =>
        i === d.index ? { x: snapped.x, y: snapped.y } : pt,
      );
      setCrosshair({ x: snapped.x, y: snapped.y });
      setSnapKind(
        snapped.kind === "vertex"
          ? "vertex"
          : snapped.kind === "ortho"
            ? "ortho"
            : null,
      );
      if (d.kind === "boundary") onBoundaryChange(next);
      else onBuildingChange(next);
    }
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    if (d?.kind === "marquee" && marquee) {
      const minX = Math.min(marquee.x1, marquee.x2);
      const maxX = Math.max(marquee.x1, marquee.x2);
      const minY = Math.min(marquee.y1, marquee.y2);
      const maxY = Math.max(marquee.y1, marquee.y2);
      const area = (maxX - minX) * (maxY - minY);
      if (area > 1.5) {
        const { w: boardW, h: boardH } = boardLayout();
        const hit = items
          .filter((i) => {
            if (i.ghost) return false;
            if (
              !resolveLayerVisual(
                ITEM_LAYER[i.t],
                layerOpacity[ITEM_LAYER[i.t]] ?? 1,
                isolatedLayer,
              ).hittable
            ) {
              return false;
            }
            const def = BY_TYPE[i.t];
            const halfWPct = ((def.w * i.scale) / 2 / boardW) * 100;
            const halfHPct = ((def.h * i.scale) / 2 / boardH) * 100;
            const left = i.x - halfWPct;
            const right = i.x + halfWPct;
            const top = i.y - halfHPct;
            const bottom = i.y + halfHPct;
            return (
              right >= minX &&
              left <= maxX &&
              bottom >= minY &&
              top <= maxY
            );
          })
          .map((i) => i.id);
        onMarqueeSelect(hit, { additive: Boolean(d.additive) });
      } else {
        // Click (not drag) on empty board — not an item / vertex handle.
        const x = (minX + maxX) / 2;
        const y = (minY + maxY) / 2;
        const insideLot =
          boundary.length >= 3 && pointInPolygon({ x, y }, boundary);
        onSelect(null);
        onEmptyClick?.({ x, y, insideLot });
      }
    }
    dragRef.current = null;
    setMarquee(null);
    setGuides({ x: null, y: null });
    setCrosshair(null);
    setSnapKind(null);
  };

  const midHandles = (pts: PctPoint[], kind: "boundary" | "building") =>
    pts.map((a, i) => {
      const b = pts[(i + 1) % pts.length]!;
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        kind,
        after: i,
      };
    });

  const insertMid = (kind: "boundary" | "building", after: number) => {
    const pts = kind === "boundary" ? boundary : building;
    const next = insertVertexAfter(pts, after);
    if (kind === "boundary") onBoundaryChange(next);
    else onBuildingChange(next);
    setNodeMenu(null);
  };

  const selected = items.find((i) => i.id === selectedId && !i.ghost) ?? null;
  const boundaryVisual = resolveLayerVisual(
    "boundary",
    layerOpacity.boundary,
    isolatedLayer,
  );
  const councilVisual = resolveLayerVisual(
    "council",
    layerOpacity.council,
    isolatedLayer,
  );
  // Service corridors + easements are the "Services & utilities" layer.
  const servicesVisual = resolveLayerVisual(
    "services",
    layerOpacity.services,
    isolatedLayer,
  );

  return (
    <div
      ref={rootRef}
      className={`${css.world}${editing ? ` ${css.worldEdit}` : ""}`}
      data-testid="cad-plan-board"
      data-cad-plan
      data-mode={mode}
      data-cursor={
        tool === "paint" ? "paint" : editing ? cursorMode : "default"
      }
      style={boardPassthrough ? { pointerEvents: "none" } : undefined}
      onPointerDown={(e) => {
        if (boardPassthrough) return;
        if (nodeMenu) setNodeMenu(null);
        if (itemMenu) setItemMenu(null);
        onPointerDownBoard(e);
      }}
      onPointerMove={boardPassthrough ? undefined : onPointerMove}
      onPointerUp={boardPassthrough ? undefined : onPointerUp}
      onPointerLeave={() => setCursorPct(null)}
    >
      <svg className={css.planSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern
            id="ws-hardscape-hatch"
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="4"
              stroke="rgba(28,25,23,0.45)"
              strokeWidth="1.2"
            />
          </pattern>
          <pattern
            id="ws-easement-hatch"
            width="3"
            height="3"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="3"
              stroke="rgba(87,83,78,0.55)"
              strokeWidth="0.9"
            />
          </pattern>
        </defs>
        {editing && boundaryVisual.hittable
          ? ([
              ["boundary", boundary],
              ["building", building],
            ] as const).flatMap(([kind, ring]) =>
              ring.map((point, index) => {
                const next = ring[(index + 1) % ring.length]!;
                const hovered =
                  hoverEdge?.kind === kind && hoverEdge.index === index;
                return (
                  <g key={`edge-hit-${kind}-${index}`}>
                    {hovered ? (
                      <line
                        x1={point.x}
                        y1={point.y}
                        x2={next.x}
                        y2={next.y}
                        className={css.edgeHover}
                        vectorEffect="non-scaling-stroke"
                      />
                    ) : null}
                    <line
                      x1={point.x}
                      y1={point.y}
                      x2={next.x}
                      y2={next.y}
                      className={css.edgeHit}
                      data-testid="cad-edge-hit"
                      vectorEffect="non-scaling-stroke"
                      onPointerDown={(event) => event.stopPropagation()}
                      onPointerEnter={() => setHoverEdge({ kind, index })}
                      onPointerLeave={() => setHoverEdge(null)}
                      onDoubleClick={(event) =>
                        insertProjected(kind, index, event)
                      }
                    />
                  </g>
                );
              }),
            )
          : null}
        {easements
          .filter((r) => r.length >= 3)
          .map((ring, i) => (
            <g key={`ease${i}`} opacity={servicesVisual.opacity} data-testid="easement-hatch">
              <polygon
                points={ptsAttr(ring)}
                fill="url(#ws-easement-hatch)"
                stroke={lines.easement.stroke}
                strokeWidth={lines.easement.strokeWidth}
                strokeDasharray={lines.easement.dash}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        {services
          .filter((r) => r.length >= 2)
          .map((ring, i) => (
            <g
              key={`svc${i}`}
              opacity={servicesVisual.opacity}
              data-testid="utility-service-trace"
            >
              <polyline
                points={ptsAttr(ring)}
                fill="none"
                stroke={lines.service.stroke}
                strokeWidth={lines.service.strokeWidth}
                strokeDasharray={lines.service.dash}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        {cadTitleMode
          ? contextLots.map((ring, i) => (
              <polygon
                key={`ctx${i}`}
                points={ptsAttr(ring)}
                className={css.cadContextLot}
                vectorEffect="non-scaling-stroke"
              />
            ))
          : null}
        <polygon
          points={ptsAttr(boundary)}
          fill={
            cadTitleMode && !fitSheetStroke
              ? "rgba(28, 25, 23, 0.045)"
              : "transparent"
          }
          stroke={bStroke}
          strokeWidth={lines.boundary.strokeWidth}
          strokeDasharray={lines.boundary.dash}
          vectorEffect="non-scaling-stroke"
          opacity={boundaryVisual.opacity * (sketchPassthrough ? 0.35 : 1)}
          className={sketchPassthrough ? css.sketchQuiet : undefined}
          data-testid={
            titleSolid || fitSheetStroke
              ? "foundation-title-boundary"
              : undefined
          }
        />
        {building.length >= 3 ? (
          <polygon
            data-testid="building-footprint"
            points={ptsAttr(building)}
            fill={bldFill}
            stroke={bldStroke}
            strokeWidth={
              foundationCleanse ? 1 : lines.building.strokeWidth
            }
            vectorEffect="non-scaling-stroke"
            opacity={
              boundaryVisual.opacity *
              (foundationCleanse ? underlayOp : 1) *
              (sketchPassthrough ? 0.4 : 1)
            }
          >
            <title>
              Existing dwelling envelope · Vicmap/site context only · confirm
              before relying on dimensions
            </title>
          </polygon>
        ) : null}
        {outsideDims.map((d) => (
          <g
            key={`odim${d.key}`}
            data-testid="outside-dim"
            opacity={boundaryVisual.opacity}
          >
            <line
              x1={d.extA.x1}
              y1={d.extA.y1}
              x2={d.extA.x2}
              y2={d.extA.y2}
              stroke={lines.dim.stroke}
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
              data-testid="outside-dim-ext"
            />
            <line
              x1={d.extB.x1}
              y1={d.extB.y1}
              x2={d.extB.x2}
              y2={d.extB.y2}
              stroke={lines.dim.stroke}
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
              data-testid="outside-dim-ext"
            />
            <line
              x1={d.x1}
              y1={d.y1}
              x2={d.x2}
              y2={d.y2}
              stroke={lines.dim.stroke}
              strokeWidth={lines.dim.strokeWidth}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={d.tickA.x1}
              y1={d.tickA.y1}
              x2={d.tickA.x2}
              y2={d.tickA.y2}
              stroke={lines.dim.stroke}
              strokeWidth={lines.dim.strokeWidth}
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={d.tickB.x1}
              y1={d.tickB.y1}
              x2={d.tickB.x2}
              y2={d.tickB.y2}
              stroke={lines.dim.stroke}
              strokeWidth={lines.dim.strokeWidth}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
        {setbackOn && !foundationCleanse && !sketchPassthrough ? (
          <polygon
            points={ptsAttr(
              boundary.map((p) => ({
                x: 50 + (p.x - 50) * 0.92,
                y: 50 + (p.y - 50) * 0.92,
              })),
            )}
            fill="none"
            stroke={lines.setback.stroke}
            strokeWidth={lines.setback.strokeWidth}
            strokeDasharray={lines.setback.dash}
            vectorEffect="non-scaling-stroke"
            opacity={0.75 * councilVisual.opacity}
            data-testid="council-setback-zone"
          >
            <title>
              {councilSetbackM != null && councilSetbackM > 0
                ? `Council setback rule · ${councilSetbackM.toFixed(1)} m (indicative)`
                : "Council setback zone (indicative)"}
            </title>
          </polygon>
        ) : null}
        {existTpz.map(({ it, tpz }) => {
          const dbh = it.dbhM ?? 0.45;
          const tpzM = Math.max(2, 12 * dbh);
          return (
            <g
              key={`tpz-${it.id}`}
              opacity={councilVisual.opacity * underlayOp}
              data-testid="exist-tpz-ring"
              data-tpz-state="zone"
            >
              {/* Tree protection as a readable council zone — not a text card */}
              <ellipse
                cx={it.x}
                cy={it.y}
                rx={tpz.rxPct}
                ry={tpz.rxPct * 0.78}
                className={css.tpzZone}
                vectorEffect="non-scaling-stroke"
              >
                <title>
                  {`Tree protection zone · AS 4970 · TPZ ≈ ${tpzM.toFixed(1)} m (12 × DBH)`}
                </title>
              </ellipse>
            </g>
          );
        })}
      </svg>

      {editing && boundaryVisual.hittable
        ? boundary.map((p, i) => (
            <button
              key={`bh${i}`}
              type="button"
              className={`${css.cornerNode}${foundationCleanse ? ` ${css.cadCorner}` : ""}${nodeFlash?.kind === "boundary" && nodeFlash.index === i ? ` ${css.cornerNodeFlash}` : ""}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              title={
                foundationCleanse ? "Drag boundary node" : "Corner vertex"
              }
              aria-label={`Boundary corner ${i + 1}`}
              data-testid="cad-title-node"
              onPointerEnter={() => setCursorMode("move")}
              onPointerLeave={() => setCursorMode("default")}
              onPointerDown={(e) => startCornerDrag("boundary", i, e)}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!foundationCleanse) removeNode("boundary", i);
              }}
              onContextMenu={(e) => {
                if (foundationCleanse) return;
                openNodeMenu("boundary", i, e);
              }}
            />
          ))
        : null}
      {editing && boundaryVisual.hittable && !foundationCleanse
        ? building.map((p, i) => (
            <button
              key={`fh${i}`}
              type="button"
              className={`${css.cornerNode} ${css.cornerNodeBuilding}${nodeFlash?.kind === "building" && nodeFlash.index === i ? ` ${css.cornerNodeFlash}` : ""}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              title="Corner vertex"
              aria-label={`Existing dwelling corner ${i + 1}`}
              onPointerEnter={() => setCursorMode("move")}
              onPointerLeave={() => setCursorMode("default")}
              onPointerDown={(e) => startCornerDrag("building", i, e)}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeNode("building", i);
              }}
              onContextMenu={(e) => openNodeMenu("building", i, e)}
            />
          ))
        : null}

      {editing && boundaryVisual.hittable && !foundationCleanse
        ? midHandles(boundary, "boundary").map((m) => (
            <div
              key={`mb${m.after}`}
              className={css.midHandle}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
              title="Split segment"
              onPointerEnter={() => setCursorMode("add")}
              onPointerLeave={() => setCursorMode("default")}
              onPointerDown={(e) => {
                e.stopPropagation();
                insertMid("boundary", m.after);
              }}
            />
          ))
        : null}
      {editing && boundaryVisual.hittable && !foundationCleanse
        ? midHandles(building, "building").map((m) => (
            <div
              key={`mf${m.after}`}
              className={`${css.midHandle} ${css.midHandleBuilding}`}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
              title="Split segment"
              onPointerEnter={() => setCursorMode("add")}
              onPointerLeave={() => setCursorMode("default")}
              onPointerDown={(e) => {
                e.stopPropagation();
                insertMid("building", m.after);
              }}
            />
          ))
        : null}

      {/* Ticks only when locked (nodes are the edit affordance — never both). */}
      {titleSolid && !editing
        ? boundary.map((p, i) => (
            <span
              key={`ftick${i}`}
              className={css.foundationVertexTick}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              aria-hidden
              data-testid="foundation-vertex-tick"
            />
          ))
        : null}

      {outsideDims.map((d) => {
        const isBuilding = d.key.startsWith("F");
        return (
          <div
            key={`olab${d.key}`}
            className={`${css.dimMark} ${css.fitOutsideDim}${cadTitleMode ? ` ${css.cadDimMark}` : ""}`}
            style={{
              left: `${d.labelX}%`,
              top: `${d.labelY}%`,
              transform: `translate(-50%, -50%) rotate(${d.rotDeg}deg)`,
            }}
            data-testid={
              frameOn
                ? "fit-outside-dim-label"
                : cadTitleMode
                  ? "cad-edge-dim"
                  : "outside-dim-label"
            }
          >
            <span
              className={
                frameOn
                  ? css.fitDimLabel
                  : cadTitleMode
                    ? css.cadDimLabel
                    : css.dimLabel
              }
              title={
                cadTitleMode
                  ? `${d.key} · ${formatCadMetres(d.lengthM)} · ${formatCadBearing(d.rotDeg)}${
                      titleMeta?.parcelRef ? ` · ${titleMeta.parcelRef}` : ""
                    }`
                  : `${isBuilding ? "Dwelling envelope" : "Boundary"} · ${d.lengthM.toFixed(2)} m`
              }
            >
              {cadTitleMode ? (
                <>
                  <span className={css.cadDimKey}>{d.key}</span>
                  <span>{formatCadMetres(d.lengthM)}</span>
                </>
              ) : (
                `${d.key} · ${d.lengthM.toFixed(2)} m`
              )}
            </span>
          </div>
        );
      })}

      {showAutoAreaLabels && boundary.length >= 3 ? (
        <div
          className={css.cadAreaLabel}
          style={{ left: `${titleCentroid.x}%`, top: `${titleCentroid.y}%` }}
          data-testid="cad-title-area"
          title={
            titleBoundaryLocked
              ? "Title locked"
              : "Title unlocked — drag corner nodes to refine"
          }
        >
          <span className={css.cadAreaKey}>Title</span>
          <span className={css.cadAreaValue}>{formatCadAreaM2(areaLabelM2)}</span>
          {titleMeta?.parcelRef ? (
            <span className={css.cadAreaMeta}>{titleMeta.parcelRef}</span>
          ) : null}
        </div>
      ) : null}

      {showAutoAreaLabels &&
      buildingCentroid &&
      building.length >= 3 &&
      buildingAreaLabelM2 > 0 ? (
        <div
          className={`${css.cadAreaLabel} ${css.cadAreaContext}`}
          style={{
            left: `${buildingCentroid.x}%`,
            top: `${buildingCentroid.y}%`,
          }}
          data-testid="cad-building-area"
        >
          <span className={css.cadAreaKey}>Existing dwelling</span>
          <span className={css.cadAreaValue}>
            {formatCadAreaM2(buildingAreaLabelM2)}
          </span>
        </div>
      ) : null}

      {showAutoAreaLabels &&
      outdoorAreaLabelM2 > 0 &&
      Math.abs(outdoorAreaLabelM2 - areaLabelM2) > 0.5 ? (
        <div
          className={`${css.cadAreaLabel} ${css.cadAreaContext}`}
          style={{
            left: `${titleCentroid.x}%`,
            top: `${Math.min(94, titleCentroid.y + 7)}%`,
          }}
          data-testid="cad-outdoor-area"
        >
          <span className={css.cadAreaKey}>Outdoor</span>
          <span className={css.cadAreaValue}>
            {formatCadAreaM2(outdoorAreaLabelM2)}
          </span>
        </div>
      ) : null}

      {cadTitleMode && !frameOn && siteLabel ? (
        <BoardChromePortal>
          <p className={css.cadStreetCue} data-testid="cad-street-cue">
            {siteLabel}
          </p>
        </BoardChromePortal>
      ) : null}

      {showHouseEnvelopeLabel && buildingCentroid ? (
        <span
          className={css.houseEnvelopeLabel}
          style={{
            left: `${buildingCentroid.x}%`,
            top: `${buildingCentroid.y}%`,
          }}
          data-testid="house-envelope-label"
        >
          Existing dwelling
        </span>
      ) : null}

      {mode === "survey" && !frameOn && boundary.length >= 3 && building.length < 3 ? (
        <p
          className={css.missingBuildingCue}
          data-testid="building-footprint-empty"
        >
          Existing dwelling outline unavailable · Trace → Existing dwelling
        </p>
      ) : null}

      {setbackOn &&
      !foundationCleanse &&
      !sketchPassthrough &&
      !frameOn &&
      boundary.length >= 3 &&
      councilSetbackM != null &&
      councilSetbackM > 0 ? (
        <p
          className={css.councilPathLabel}
          data-testid="council-setback-path-label"
          style={{
            left: `${50 + (titleCentroid.x - 50) * 0.92}%`,
            top: `${Math.max(8, 50 + (Math.min(...boundary.map((p) => p.y)) - 50) * 0.92 - 1.2)}%`,
          }}
        >
          {councilSetbackM.toFixed(1)} m setback rule
        </p>
      ) : null}

      {!foundationCleanse
        ? existTpz.map(({ it, tpz }) => {
            const showTag = it.id === selectedId || it.id === hoverId;
            const size = Math.max(28, tpz.rxPct * 2.2);
            return (
              <div key={`tpzui-${it.id}`}>
                <button
                  type="button"
                  className={css.tpzHit}
                  data-testid="exist-tpz-hit"
                  aria-label={`Tree protection zone ≈ ${tpz.radiusM.toFixed(1)} metres`}
                  style={{
                    left: `${it.x}%`,
                    top: `${it.y}%`,
                    width: `${size}%`,
                    height: `${size * 0.78}%`,
                    opacity: councilVisual.opacity,
                    pointerEvents: councilVisual.hittable ? undefined : "none",
                  }}
                  onPointerEnter={() => onHover(it.id)}
                  onPointerLeave={() => onHover(null)}
                />
                <div
                  className={css.tpzPop}
                  style={{ left: `${it.x}%`, top: `${Math.max(6, it.y - tpz.rxPct * 0.5)}%` }}
                >
                  Tree protection · AS 4970 · ≈ {tpz.radiusM.toFixed(1)} m
                </div>
                {showTag ? (
                  <div
                    className={css.tpzTag}
                    style={{
                      left: `${Math.min(96, it.x + tpz.rxPct * 0.72)}%`,
                      top: `${Math.max(4, it.y - tpz.rxPct * 0.35)}%`,
                    }}
                  >
                    TPZ Ø{tpz.radiusM.toFixed(1)} m
                  </div>
                ) : null}
              </div>
            );
          })
        : null}

      {planItems.map((it) => {
        const d = BY_TYPE[it.t];
        const gk = growthFactor(growth, !!d.existing);
        const w = Math.round(d.w * it.scale * gk);
        const h = Math.round(d.h * it.scale * gk);
        const bucket = ITEM_LAYER[it.t];
        const layerVisual = resolveLayerVisual(
          bucket,
          layerOpacity[bucket] ?? 1,
          isolatedLayer,
        );
        const isCur = it.id === curGhostId;
        const selected = it.id === selectedId;
        const hovered = it.id === hoverId;
        const flagged = flaggedIds?.has(it.id) && !it.ghost;
        const previewType =
          previewSwatch && hovered && !it.ghost && it.t !== previewSwatch
            ? previewSwatch
            : null;
        return (
          <div
            key={it.id}
            className={`${css.item}${it.ghost && it.stale ? ` ${css.stalePulse}` : ""}${flagged ? ` ${css.flagged}` : ""}${foundationCleanse ? ` ${css.itemUnderlay}` : ""}${selected || groupIds.includes(it.id) ? ` ${css.itemSelected}` : ""}${paintFlashId === it.id ? ` ${css.paintFlash}` : ""}`}
            data-testid={it.ghost ? "studio-ghost" : "studio-item"}
            data-item-type={it.t}
            data-layer={bucket}
            data-hittable={layerVisual.hittable ? "true" : "false"}
            data-selected={selected || groupIds.includes(it.id) ? "true" : "false"}
            style={{
              left: `${it.x}%`,
              top: `${it.y}%`,
              width: w,
              height: h,
              borderRadius: d.br,
              opacity:
                (it.ghost ? 0.45 : 1) * layerVisual.opacity * underlayOp,
              pointerEvents:
                foundationCleanse || !layerVisual.hittable ? "none" : undefined,
              transform: `translate(-50%, -50%) rotate(${it.rot}deg)`,
              border: it.ghost
                ? isCur
                  ? "1.5px solid #1c1917"
                  : it.stale
                    ? "1px dashed #8a6a1f"
                    : "1px dashed rgba(28,25,23,0.55)"
                : flagged
                  ? "1.5px solid #1c1917"
                  : selected || groupIds.includes(it.id)
                    ? "1.5px solid #1c1917"
                    : hovered && !it.ghost
                      ? "1px solid rgba(28,25,23,0.45)"
                      : "none",
              boxShadow:
                selected || groupIds.includes(it.id)
                  ? undefined
                  : "none",
              zIndex: isCur
                ? 50
                : selected || groupIds.includes(it.id)
                  ? 20
                  : hovered
                    ? 10
                    : 2,
            }}
            title={
              it.stale
                ? `${it.why ?? d.name} · nearby edit — recheck this`
                : (it.why ?? d.name)
            }
            onPointerEnter={() => onHover(it.id)}
            onPointerLeave={() => onHover(null)}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (eyedropArmed && onEyedrop) {
                onEyedrop(it.t);
                return;
              }
              if (tool === "paint" && !it.ghost && onPaintItem) {
                onPaintItem(it.id);
                return;
              }
              const additive = e.shiftKey || e.metaKey;
              onSelect(it.id, { additive });
              if (!it.ghost && tool !== "lock" && tool !== "paint") {
                const ids =
                  groupIds.includes(it.id) && groupIds.length > 1
                    ? groupIds
                    : [it.id];
                if (ids.length > 1) {
                  const p = toPct(e.clientX, e.clientY);
                  const start = gridSnap ? snapToGridMetres(p, scaleM) : p;
                  dragRef.current = {
                    kind: "group",
                    ids,
                    startX: start.x,
                    startY: start.y,
                  };
                  setCrosshair(start);
                } else {
                  dragRef.current = { kind: "item", id: it.id, ox: 0, oy: 0 };
                  setCrosshair({ x: it.x, y: it.y });
                }
                (e.target as Element).setPointerCapture?.(e.pointerId);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (it.ghost) return;
              setNodeMenu(null);
              setItemMenu({ id: it.id, t: it.t, x: it.x, y: it.y });
            }}
          >
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <StudioGlyph type={it.t} ink={!darkOn || frameOn} />
            </div>
            {previewType ? (
              <div
                className={css.swatchPreview}
                data-testid="swatch-hover-preview"
                aria-hidden
              >
                <StudioGlyph type={previewType} ink={!darkOn || frameOn} />
              </div>
            ) : null}
            {flagged && (it.t === "paving" || it.t === "deck") ? (
              <div className={css.hatchOverlay} aria-hidden />
            ) : null}
            {it.ghost && (isCur || hovered) ? (
              <span
                className={`${css.aiChip}${isCur ? ` ${css.aiChipHot}` : ""}`}
              >
                AI
              </span>
            ) : null}
            {isCur && !frameOn && !reviewOpen ? (
              <div
                className={css.ghostActions}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className={css.acceptBtn}
                  onClick={() => onAcceptGhost(it.id)}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className={css.rejectBtn}
                  title="Reject suggestion"
                  onClick={() => onRejectGhost(it.id)}
                >
                  ✕
                </button>
              </div>
            ) : null}
            {selected && !it.ghost && d.heightM && !frameOn ? (
              <button
                type="button"
                className={css.tracePill}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onTraceInElevation(it.id)}
              >
                ⇄ Trace in elevation
              </button>
            ) : null}
          </div>
        );
      })}

      {marquee ? (
        <div
          className={css.marquee}
          style={{
            left: `${Math.min(marquee.x1, marquee.x2)}%`,
            top: `${Math.min(marquee.y1, marquee.y2)}%`,
            width: `${Math.abs(marquee.x2 - marquee.x1)}%`,
            height: `${Math.abs(marquee.y2 - marquee.y1)}%`,
          }}
        />
      ) : null}

      {showDraftGrid ? (
        <DraftGridMesh
          grain={gridGrain}
          step={gridStep}
          formation={gridFormation}
          ink={gridInk}
        />
      ) : null}

      {crosshair ? (
        <>
          <div
            className={css.snapPulse}
            data-testid="snap-radial-pulse"
            style={{ left: `${crosshair.x}%`, top: `${crosshair.y}%` }}
          />
          <div
            className={`${css.crosshairV}`}
            data-testid="draft-crosshair-v"
            style={{ left: `${crosshair.x}%` }}
          />
          <div
            className={`${css.crosshairH}`}
            data-testid="draft-crosshair-h"
            style={{ top: `${crosshair.y}%` }}
          />
          {snapKind ? (
            <div
              className={css.snapGlyph}
              data-testid="snap-glyph"
              data-snap={snapKind}
              style={{ left: `${crosshair.x}%`, top: `${crosshair.y}%` }}
              title={
                snapKind === "vertex"
                  ? "Snapped to vertex"
                  : snapKind === "align"
                    ? "Aligned to neighbour"
                    : snapKind === "ortho"
                      ? "Orthogonal lock"
                      : "Snapped to grid"
              }
              aria-hidden
            >
              {snapKind === "vertex"
                ? "●"
                : snapKind === "align"
                  ? "∥"
                  : snapKind === "ortho"
                    ? "∟"
                    : "□"}
            </div>
          ) : null}
        </>
      ) : null}

      {guides.x != null ? (
        <div className={css.guideV} style={{ left: `${guides.x}%` }} />
      ) : null}
      {guides.y != null ? (
        <div className={css.guideH} style={{ top: `${guides.y}%` }} />
      ) : null}

      {selected && !frameOn && tool !== "lock" ? (
        <SelectionHandles
          item={selected}
          boardW={rootRef.current?.clientWidth ?? 960}
          boardH={rootRef.current?.clientHeight ?? 640}
          planZoom={planZoom}
          planPanX={planPanX}
          planPanY={planPanY}
          planFocusX={planFocusX}
          planFocusY={planFocusY}
          planRotateDeg={planRotateDeg}
          onTransform={onTransformItem}
        />
      ) : null}

      {selected && !frameOn && !dragRef.current ? (
        <div
          className={css.selectedReadout}
          data-testid="selected-shape-readout"
          style={{ left: `${selected.x}%`, top: `${selected.y}%` }}
        >
          <span className={css.selectedReadoutTag}>
            {describeSelectedItem(selected).tag}
          </span>
          <span className={css.selectedReadoutValue}>
            {describeSelectedItem(selected).value}
          </span>
        </div>
      ) : null}

      {tpzReadouts?.map((r) =>
        r.active ? (
          <div
            key={r.id}
            className={css.tpzReadout}
            data-testid="tpz-encroach-readout"
            style={{ left: `${r.x}%`, top: `${r.y}%` }}
          >
            TPZ {Math.round(r.pct)}%
          </div>
        ) : null,
      )}

      {editing ? (
        <BoardChromePortal>
          <div className={css.editBanner} data-testid="edit-vector-banner">
            Hover node to move · hover edge diamond to add · right-click node to
            delete
          </div>
        </BoardChromePortal>
      ) : null}

      {cursorPct ? (
        <div
          className={css.cursorBadge}
          data-testid="smart-cursor-badge"
          style={{ left: `${cursorPct.x}%`, top: `${cursorPct.y}%` }}
        >
          <span className={css.cursorTool}>{toolLabel}</span>
        </div>
      ) : null}

      {nodeMenu ? (
        <div
          className={css.nodeMenu}
          data-testid="vector-node-menu"
          style={{ left: `${nodeMenu.x}%`, top: `${nodeMenu.y}%` }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={css.nodeMenuBtn}
            disabled={
              (nodeMenu.kind === "boundary"
                ? boundary.length
                : building.length) <= 3
            }
            onClick={() => removeNode(nodeMenu.kind, nodeMenu.index)}
          >
            Delete node
          </button>
          <button
            type="button"
            className={css.nodeMenuBtn}
            onClick={() => insertMid(nodeMenu.kind, nodeMenu.index)}
          >
            Add node after
          </button>
          <button
            type="button"
            className={css.nodeMenuBtn}
            onClick={() => setNodeMenu(null)}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {itemMenu ? (
        <div
          className={css.radialMenu}
          data-testid="item-radial-menu"
          style={{ left: `${itemMenu.x}%`, top: `${itemMenu.y}%` }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className={`${css.radialBtn} ${css.radialNorth}`}
            onClick={() => {
              onSelect(itemMenu.id);
              setItemMenu(null);
            }}
          >
            Select
          </button>
          <button
            type="button"
            className={`${css.radialBtn} ${css.radialEast}`}
            onClick={() => {
              onEyedrop?.(itemMenu.t);
              setItemMenu(null);
            }}
          >
            Pick
          </button>
          <button
            type="button"
            className={`${css.radialBtn} ${css.radialSouth}`}
            onClick={() => {
              onPaintItem?.(itemMenu.id);
              setItemMenu(null);
            }}
          >
            Fill
          </button>
          <button
            type="button"
            className={`${css.radialBtn} ${css.radialWest}`}
            onClick={() => setItemMenu(null)}
          >
            Close
          </button>
        </div>
      ) : null}

      {easements.some((r) => r.length >= 3) ||
      services.some((r) => r.length >= 2) ? (
        <BoardChromePortal>
          <div className={css.honestyStack}>
            {easements.some((r) => r.length >= 3) ? (
              <p
                className={css.honestyFooter}
                data-testid="easement-honesty-footer"
              >
                Easement hatch · indicative only — confirm with title / council
                before excavation
              </p>
            ) : null}
            {services.some((r) => r.length >= 2) ? (
              <p
                className={css.honestyFooter}
                data-testid="utility-honesty-footer"
              >
                Utility traces · indicative — confirm locate / DBYD before dig
              </p>
            ) : null}
          </div>
        </BoardChromePortal>
      ) : null}
    </div>
  );
}
