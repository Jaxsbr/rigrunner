import { defineComponent } from '@core/component';
import type { TierId } from '@common/parts/tiers';

/**
 * Marks an entity as a **world shop** — a structure the rig drives to in order to buy (and sell) parts,
 * the in-world replacement for the old workshop Shop tab. A shop is proximity-gated exactly like a
 * `WorkshopZone`: its interface only opens while the rig is parked within reach.
 *
 * It carries the **stock-list seam** every later mechanic rides on:
 *  - `tier` — the grade everything this shop sells is minted at (a rusty shop sells rusty parts). One
 *    intrinsic tier per shop, so there is no in-UI tier selector to silently reprice the list.
 *  - `stock` — the catalog `partId`s this shop carries. A **subset** is "partial stock"; a `partId`
 *    only one shop lists is a "unique part" — so tiers, partial/unique stock and (later) set-completion
 *    all attach to this one field without reworking the UI.
 *  - `radius` — the interaction zone in metres from the shop centre (circle-vs-circle against the rig's
 *    collider, like the workshop).
 *  - `active` — recomputed each frame by `shopZoneSystem` from the rig's position; cached here so the
 *    prompt and the proximity disc read one answer. View owns no truth — this flag is the truth.
 */
export interface WorldShop {
  tier: TierId;
  stock: string[];
  radius: number;
  active: boolean;
}

export const WorldShop = defineComponent<WorldShop>('WorldShop');
