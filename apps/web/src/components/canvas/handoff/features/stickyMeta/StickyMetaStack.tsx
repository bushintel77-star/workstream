"use client";

/**
 * Vic-gov status chip row — replaces the former four stacked sticky cards
 * (Environment / Services / Site / Trees). One horizontal panel of truth.
 */

export { VicGovStatusChipRow as StickyMetaStack } from "./VicGovStatusChipRow";
export type { VicGovChipPanel as StickyMetaActivePanel } from "./vicGovChipStatus";

import {
  restoreStickyMeta,
  type StickyMetaCardId,
} from "./stickyMetaPrefs";

/** Re-summon a dismissed sticky face (Cmd+K / header) — prefs kept for restore. */
export function summonStickyMeta(projectId: string, id: StickyMetaCardId) {
  restoreStickyMeta(projectId, id);
}
