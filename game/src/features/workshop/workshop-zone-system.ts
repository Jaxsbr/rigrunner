import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { recomputeProximityGate } from '@common/sim/proximity-gate';
import { WorkshopZone } from '@features/workshop/workshop-zone';

/**
 * Recompute each workshop's proximity gate: a WorkshopZone is `active` while the player's rig is
 * intersecting its circle, dormant otherwise. The build controller reads this to decide whether a
 * workshop's grid is a valid drop target; the render layer reads it to colour the zone overlay.
 *
 * The circle-vs-circle gating itself lives in `@common/sim/proximity-gate` (shared with the world shop, so
 * the two can't drift); this is just the workshop's binding of that mechanic to the `WorkshopZone` component.
 */
export function workshopZoneSystem(world: World, rig: EntityId): void {
  recomputeProximityGate(world, rig, WorkshopZone);
}
