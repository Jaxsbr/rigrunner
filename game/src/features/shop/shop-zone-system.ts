import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { recomputeProximityGate } from '@common/sim/proximity-gate';
import { WorldShop } from './world-shop';

/**
 * Recompute each world shop's proximity gate: a `WorldShop` is `active` while the player's rig is
 * intersecting its circle, dormant otherwise. The shop interface reads this to decide when its tab
 * shows / E opens it; the render layer reads it to light the zone disc.
 *
 * The circle-vs-circle gating itself lives in `@common/sim/proximity-gate` (shared with the workshop, so
 * the two can't drift); this is just the shop's binding of that mechanic to the `WorldShop` component.
 */
export function shopZoneSystem(world: World, rig: EntityId): void {
  recomputeProximityGate(world, rig, WorldShop);
}
