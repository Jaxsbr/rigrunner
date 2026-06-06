import { defineComponent } from '@core/component';
import type { LootFind } from '@common/sim/loot';

/**
 * A pending loot drop (Option C / PR5) — the bridge from "an objective paid out" to the loot UI that
 * reveals what it gave. Created on its own throwaway entity by whatever cleared (a rummaged pile, a
 * cleared camp); the loot overlay opens the frame one appears. It carries:
 *   - `scrap`  — loose-scrap pieces SCATTERED into the world for drive-over collection (a pile's burst).
 *     Shown for information, NOT granted here. 0 for a camp, which doesn't scatter.
 *   - `walletScrap` — scrap granted STRAIGHT to the Wallet on collect (a camp isn't a heap, so there's
 *     no scatter-and-sweep). Omitted/0 for a pile. This is the one field the overlay actually banks.
 *   - `finds`  — the rolled non-scrap finds as DATA, not yet granted. The overlay reads them, shows the
 *     reward, and on close turns each into an owned part in `Inventory`, then destroys this entity.
 *     Holding the finds (not pre-created part entities) keeps the reward off the world until collected.
 *
 * It lives on its own throwaway entity (no Transform/Renderable — it isn't in the scene), queried by
 * the UI; this keeps the sim the source of truth (a drop exists ⇒ there's loot to show) with no
 * parallel UI store.
 */
export interface LootDrop {
  scrap: number;
  /** Scrap banked straight to the Wallet on collect (camp loot). Omitted/0 for scatter-and-sweep piles. */
  walletScrap?: number;
  finds: LootFind[];
}

export const LootDrop = defineComponent<LootDrop>('LootDrop');
