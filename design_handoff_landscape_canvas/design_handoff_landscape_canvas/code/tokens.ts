/** Design tokens — README §4. Nothing in the app hard-codes a colour or a size. */

export const color = {
  canvasBg: '#1a1c1e',
  canvasBgSketch: '#131517',
  panelBg: '#1c1e21',
  glassBg: 'rgba(26,28,30,.86)',
  glassGrad: 'linear-gradient(180deg,rgba(30,33,35,.93),rgba(22,24,26,.90))',
  glassBorder: 'rgba(232,230,224,.13)',
  glassInset: '0 1px 0 rgba(255,255,255,.07) inset',
  flyoutShadow: '14px 18px 38px rgba(0,0,0,.42)',
  trackBorder: 'rgba(232,230,224,.10)',
  ink: '#e8e6e0',
  ink60: 'rgba(232,230,224,.55)',
  ink40: 'rgba(232,230,224,.40)',
  ink30: 'rgba(232,230,224,.30)',
  surfaceTint: 'rgba(232,230,224,.06)',
  accent: 'oklch(0.68 0.12 145)',
  accentHi: 'oklch(0.87 0.11 145)',
  accentOn: '#10120f',
  mass: 'oklch(0.72 0.11 55)',
  redline: 'oklch(0.62 0.16 25)',
  hazard: 'oklch(0.78 0.12 60)',
  paperBg: '#f4f2ec',
  paperInk: '#1a1a1a',
} as const;

/** Outdoor palette — site mode only (13a). Not a theme toggle; a different product. */
export const outdoor = {
  ink: '#f2f0ea',
  glassOpacity: 0.9,
  labelPx: 11,          // the 9.5px floor is raised in sun
  accentLightnessBoost: 0.04,
  minTargetPx: 56,
} as const;

export const type = {
  ui: 'Archivo, sans-serif',
  mono: '"IBM Plex Mono", monospace',
  /** Hard floor. An outdoor-legibility constraint, not a preference (§3). */
  monoFloorPx: 9.5,
  groupHeaderPx: 8.5,
} as const;

export const geometry = {
  chromeInset: 22,
  trackRadius: 16,
  ribbon: { rail: 56, standard: 88, named: 236, radius: 19, pad: 8, tileRadius: 11, tileGap: 4 },
  flyout: { width: 238, wide: 296, radius: 16, arrow: 9 },
  dock: { radius: 19, button: 80, buttonActive: 86, pip: [18, 2] as const },
  depthRail: { cell: [48, 32] as const, radius: 13 },
  planeCard: [74, 46] as const,
  viewpointThumb: [82, 52] as const,
} as const;

/** Dash signatures (8c). Semantic lines must survive greyscale and colour-blind review. */
export const signature = {
  setback:  { dash: [26, 10],       ends: 'bar',    weightMm: 0.5  },
  gas:      { dash: [18, 7, 3, 7],  ends: 'glyph:G', weightMm: 0.35 },
  services: { dash: [3, 8],         ends: 'node',   weightMm: 0.35 },
  survey:   { dash: [7, 5],         ends: 'cross',  weightMm: 0.25 },
  canopy:   { dash: [11, 8],        ends: 'arc',    weightMm: 0.4  },
  drafting: { dash: [],             ends: 'none',   weightMm: 0.3  },
} as const;

/** Weights are mm at issued scale. Convert only at render, never store px. */
export const mmToPx = (mm: number, scaleDenominator: number, dpi = 96) =>
  (mm / 25.4) * dpi * (200 / scaleDenominator);
