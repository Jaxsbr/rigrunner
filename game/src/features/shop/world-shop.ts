import { defineComponent } from '@core/component';
import type { TierId } from '@common/parts/tiers';

/**
 * Marks an entity as a **world shop** — a structure the rig drives to in order to buy (and sell) parts,
 * the in-world replacement for the old workshop Shop tab. A shop is proximity-gated exactly like a
 * `WorkshopZone` (it satisfies `ProximityGate`): its interface only opens while the rig is parked in reach.
 *
 *  - `tier` — the grade everything this shop sells is minted at (a rusty shop sells rusty parts). One
 *    intrinsic tier per shop, so there is no in-UI tier selector to silently reprice the list. A shop
 *    sells the FULL priced catalogue at this tier — there is no per-shop "stock" subset (buying is "any
 *    part the shop sells, always available"; partial/unique stock is an idea we deliberately did NOT build).
 *  - `radius` — the interaction zone in metres from the shop centre (circle-vs-circle against the rig's
 *    collider, like the workshop).
 *  - `active` — recomputed each frame by `shopZoneSystem` from the rig's position; cached here so the
 *    prompt and the proximity disc read one answer. View owns no truth — this flag is the truth.
 */
export interface WorldShop {
  tier: TierId;
  radius: number;
  active: boolean;
}

export const WorldShop = defineComponent<WorldShop>('WorldShop');
