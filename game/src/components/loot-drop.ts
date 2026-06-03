import { defineComponent } from '../core/component';
import type { LootFind } from '../content/loot-table';

/**
 * A pending loot drop (Option C / PR5) — the bridge from "a pile was emptied and rolled some finds"
 * to the loot UI that reveals them. The rummage system creates ONE LootDrop entity per cleared pile
 * whose empty-roll yielded anything (no finds ⇒ no LootDrop, so the burst-only common case shows no
 * popup). It carries the rolled finds as DATA, not yet granted: the loot overlay reads them, shows
 * the reward, and on close turns each find into an owned part in `Inventory`, then destroys this
 * entity. Holding the finds (not pre-created part entities) keeps the not-yet-granted reward off the
 * world until the player actually collects it.
 *
 * It lives on its own throwaway entity (no Transform/Renderable — it isn't in the scene), queried by
 * the UI; this keeps the sim the source of truth (a drop exists ⇒ there's loot to show) with no
 * parallel UI store.
 */
export interface LootDrop {
  finds: LootFind[];
}

export const LootDrop = defineComponent<LootDrop>('LootDrop');
