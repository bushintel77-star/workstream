/** Trade packs — why 21 tools fit an 88px ribbon (README §18).
 *  The pack scopes which GROUPS appear. It is not a preference; it is the height budget.
 *  Measured: the full CAD pack ends 74px clear of the bottom on 1194×834. One more group does not fit. */

export type ToolGroup = 'DRAW' | 'GRADE' | 'PLANT' | 'BUILD' | 'MEASURE' | 'SERVICE' | 'WATER' | 'CANVAS' | 'VIEW';

export interface Tool { id: string; label: string; hotkey?: string; hasFlyout: boolean; }

export const groups: Record<ToolGroup, Tool[]> = {
  DRAW:    [{ id: 'pen', label: 'PEN', hotkey: 'P', hasFlyout: true },
            { id: 'line', label: 'LINE', hotkey: 'L', hasFlyout: false },
            { id: 'spline', label: 'SPLINE', hotkey: 'S', hasFlyout: true }],
  GRADE:   [{ id: 'contour', label: 'CONTOUR', hotkey: 'C', hasFlyout: true },
            { id: 'slope', label: 'SLOPE', hotkey: 'G', hasFlyout: true },
            { id: 'cutfill', label: 'CUT/FIL', hasFlyout: true }],
  PLANT:   [{ id: 'tree', label: 'TREE', hasFlyout: true }, { id: 'bed', label: 'BED', hasFlyout: true }],
  BUILD:   [{ id: 'mass', label: 'MASS', hasFlyout: true }, { id: 'path', label: 'PATH', hasFlyout: true }],
  MEASURE: [{ id: 'dim', label: 'DIM', hasFlyout: false }, { id: 'section', label: 'SECTION', hasFlyout: true }],
  SERVICE: [{ id: 'trench', label: 'TRENCH', hasFlyout: true }, { id: 'light', label: 'LIGHT', hasFlyout: true }],
  WATER:   [{ id: 'drip', label: 'DRIP', hasFlyout: true }, { id: 'spray', label: 'SPRAY', hasFlyout: true },
            { id: 'agg', label: 'AGG', hasFlyout: true }],
  CANVAS:  [{ id: 'lay', label: 'LAY', hasFlyout: true }, { id: 'stand', label: 'STAND', hasFlyout: true },
            { id: 'xfer', label: 'XFER', hasFlyout: true }],
  VIEW:    [{ id: 'mark', label: 'MARK', hasFlyout: false }],
};

export const packs = {
  survey: ['DRAW', 'GRADE', 'MEASURE'],
  cad:    ['DRAW', 'GRADE', 'PLANT', 'BUILD', 'MEASURE'],
  civil:  ['DRAW', 'GRADE', 'SERVICE', 'WATER', 'MEASURE'],
  sketch: ['DRAW', 'CANVAS', 'VIEW'],
} satisfies Record<string, ToolGroup[]>;

export type PackId = keyof typeof packs;

/** Guard the budget in code, not in review. 88px ribbon on the shortest supported screen. */
const TILE_H = 42.5, HEADER_H = 15, DIVIDER_H = 14, CHROME_H = 37, UTILITY_H = 32;
export function ribbonHeight(pack: PackId) {
  const gs = packs[pack];
  const tiles = gs.reduce((n, g) => n + groups[g].length, 0);
  return CHROME_H + tiles * TILE_H + gs.length * HEADER_H + (gs.length - 1) * DIVIDER_H + UTILITY_H;
}
export function assertFits(pack: PackId, screenH: number, top = 72, bottomClearance = 52) {
  const h = ribbonHeight(pack);
  if (top + h > screenH - bottomClearance)
    throw new Error(`Pack "${pack}" is ${Math.round(top + h - screenH + bottomClearance)}px over budget. Split it — do not shrink labels below ${9.5}px.`);
}
