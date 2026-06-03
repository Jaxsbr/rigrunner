import { defineComponent } from '../core/component';
import type { LootFind } from '../content/loot-table';

/**
 * A pending loot drop (Option C / PR5) — the bridge from "a pile was emptied" to the loot UI that
 * reveals what it gave. The rummage system creates ONE LootDrop entity per cleared pile (always — a
 * pile always yields scrap, so the popup always has something to report). It carries:
 *   - `scrap`  — how many loose-scrap pieces the pile scattered (the burst yield, already scattered
 *     into the world for drive-over collection; shown for information, NOT granted again here).
 *   - `finds`  — the rolled non-scrap finds as DATA, not yet granted. The loot overlay reads them,
 *     shows the reward, and on close turns each find into an owned part in `Inventory`, then destroys
 *     this entity. Holding the finds (not pre-created part entities) keeps the not-yet-granted reward
 *     off the world until the player actually collects it. Empty about half the time (50% miss).
 *
 * It lives on its own throwaway entity (no Transform/Renderable — it isn't in the scene), queried by
 * the UI; this keeps the sim the source of truth (a drop exists ⇒ there's loot to show) with no
 * parallel UI store.
 */
export interface LootDrop {
  scrap: number;
  finds: LootFind[];
}

export const LootDrop = defineComponent<LootDrop>('LootDrop');
