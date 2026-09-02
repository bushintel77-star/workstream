/** The store — README §9. One slice per concern; derived values are selectors. */
import { create } from 'zustand';
import type { CameraMode } from './FusedCamera';

export type PlaneId = string;

export interface Plane {
  id: PlaneId; name: string; z: number;
  state: 'existing' | 'proposed'; stage: '01' | '02' | 'FUT';
  opacity: number; visible: boolean; locked: boolean; imported: boolean;
  strokeCount: number; objectCount: number;
}

export interface SiteObject {
  id: string; type: 'bed' | 'tree' | 'paving' | 'edge' | 'mass' | 'trench' | 'fixture';
  name: string; code: string; planeId: PlaneId; materialId: string;
  geometry: number[][]; qty?: number; area?: number; spread?: number;
}

interface Store {
  camera: { mode: CameraMode; tilt: number; azimuth: number; zoom: number; lastMode: CameraMode };
  planes: Plane[]; activePlaneId: PlaneId;
  objects: SiteObject[];
  tool: { group: string; id: string; ribbonWidth: 'rail' | 'standard' | 'named'; flyoutOpen: boolean };
  /** Driven by pen contact only — never by a user control (§9). */
  quiet: boolean;
  /** Unscaled is a first-class state, not an error (15a). */
  scale: { known: boolean; ratio: number | null };
  setCamera(mode: CameraMode): void;
  setActivePlane(id: PlaneId): void;
}

export const useStore = create<Store>((set, get) => ({
  camera: { mode: 'plan', tilt: 0, azimuth: 0, zoom: 1, lastMode: 'plan' },
  planes: [], activePlaneId: 'ground', objects: [],
  tool: { group: 'GRADE', id: 'contour', ribbonWidth: 'standard', flyoutOpen: false },
  quiet: false,
  scale: { known: false, ratio: null },
  setCamera: (mode) => set((s) => ({ camera: { ...s.camera, mode, lastMode: s.camera.mode } })),
  setActivePlane: (id) => set({ activePlaneId: id }),
}));

/* ---- Derived. Never stored. The schedule is read-only in this direction (§6.2). ---- */

export const selectScheduleRows = (s: Store) => {
  const groups = { CANOPY: [] as SiteObject[], BEDS: [] as SiteObject[], HARDSCAPE: [] as SiteObject[] };
  for (const o of s.objects) {
    if (o.type === 'tree') groups.CANOPY.push(o);
    else if (o.type === 'bed') groups.BEDS.push(o);
    else if (o.type === 'paving' || o.type === 'edge') groups.HARDSCAPE.push(o);
  }
  return groups;
};

export const selectSoftscapeArea = (s: Store) =>
  s.objects.filter((o) => o.type === 'bed').reduce((a, o) => a + (o.area ?? 0), 0);

/** Unscaled projects must render "—", not a number that isn't true (15a). */
export const formatArea = (s: Store, m2: number) =>
  s.scale.known ? `${m2.toFixed(1)} m²` : `${Math.round(m2)} sq · unscaled`;
