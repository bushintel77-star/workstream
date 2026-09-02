/** The 2D/3D chrome contract (11c) as data, not as scattered conditionals.
 *  Rule: nothing in the chrome changes POSITION between camera states. Every element does exactly one of
 *  four things. If an element cannot state true units in a view, it converts or locks — it never quietly
 *  keeps showing a number that is not true. Anything added later must be added to this table. */
import type { CameraMode } from './FusedCamera';

export type Behaviour =
  | { kind: 'same' }
  | { kind: 'convert'; to: string; note: string }
  | { kind: 'lock'; reason: string }
  | { kind: 'hide'; reason: string };

export type ChromeElement =
  | 'rulerMargin' | 'crosshairCoords' | 'dimensions' | 'depthRail' | 'ribbonGrade'
  | 'ribbonMeasure' | 'weightControl' | 'commentPins' | 'suncastDrainage'
  | 'wfsChips' | 'panels' | 'schedule';

const same: Behaviour = { kind: 'same' };

export const CONTRACT: Record<ChromeElement, Record<CameraMode, Behaviour>> = {
  rulerMargin: {
    plan: same, axo: same,
    sec:  { kind: 'convert', to: 'vertical RL datums', note: 'one column, single left margin (6c)' },
    '3d': { kind: 'convert', to: 'horizon band, bearings only', note: 'chainage would be false in perspective' },
  },
  crosshairCoords: {
    plan: same, axo: same, sec: same,
    '3d': { kind: 'convert', to: 'eye height · bearing · fov', note: 'E/N/Z has no single value under perspective' },
  },
  dimensions: {
    plan: same, axo: same, sec: same,
    '3d': { kind: 'convert', to: 'billboarded, prefixed ≈', note: 'legible but marked indicative; not issuable' },
  },
  depthRail: {
    plan: same, axo: same,
    sec:  { kind: 'convert', to: 'band selector MAS/PLT/GRD/SUB', note: '' },
    '3d': { kind: 'convert', to: 'skewed stack', note: 'reads as space, same position' },
  },
  ribbonGrade: {
    plan: same, axo: same, sec: same,
    '3d': { kind: 'lock', reason: 'locked in perspective — switch to PLAN or AXO to measure' },
  },
  ribbonMeasure: {
    plan: same, axo: same,
    sec:  { kind: 'convert', to: 'draw-on-section', note: 'strokes land on the section plane' },
    '3d': { kind: 'lock', reason: 'locked in perspective — switch to PLAN or AXO to measure' },
  },
  weightControl: {
    plan: same, axo: same, sec: same,
    '3d': { kind: 'convert', to: 'screen px', note: 'mm-at-scale is meaningless without a sheet scale — say so' },
  },
  commentPins: {
    plan: same, axo: same,
    sec:  { kind: 'hide', reason: 'only pins on the cut are shown' },
    '3d': { kind: 'convert', to: 'depth-scaled, occluded by mass', note: '' },
  },
  suncastDrainage: {
    plan: same, axo: same,
    '3d': { kind: 'convert', to: 'volumetric', note: '' },
    sec:  { kind: 'hide', reason: 'meaningless on a cut' },
  },
  wfsChips: { plan: same, axo: same, sec: same, '3d': same },
  panels:   { plan: same, axo: same, sec: same, '3d': same },
  schedule: { plan: same, axo: same, sec: same, '3d': same },
};

export const behaviourOf = (el: ChromeElement, cam: CameraMode) => CONTRACT[el][cam];
export const isLocked = (el: ChromeElement, cam: CameraMode) => CONTRACT[el][cam].kind === 'lock';
export const lockReason = (el: ChromeElement, cam: CameraMode) => {
  const b = CONTRACT[el][cam];
  return b.kind === 'lock' ? b.reason : null;
};
