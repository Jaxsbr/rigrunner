import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Collider } from '../components/collider';
import { WorkshopZone } from '../components/workshop-zone';

/**
 * Recompute each workshop's proximity gate: a WorkshopZone is `active` while the player's rig is
 * intersecting its circle, dormant otherwise. The build controller reads this to decide whether a
 * workshop's grid is a valid drop target; the render layer reads it to colour the zone overlay.
 *
 * Intersection is circle-vs-circle — the rig's collider overlapping the zone — so parking the rig
 * BESIDE the platform counts, not just driving its centre onto the marker:
 *   distance(rig, workshop) ≤ zone.radius + rigColliderRadius.
 *
 * Pure over the World (one boolean write per workshop), so it runs and tests headless.
 */
export function workshopZoneSystem(world: World, rig: EntityId): void {
  const rigT = world.get(rig, Transform);
  const rigR = world.get(rig, Collider)?.radius ?? 0;

  for (const w of world.query(WorkshopZone, Transform)) {
    const zone = world.get(w, WorkshopZone)!;
    if (!rigT) {
      zone.active = false;
      continue;
    }
    const wt = world.get(w, Transform)!;
    const d = Math.hypot(wt.x - rigT.x, wt.z - rigT.z);
    zone.active = d <= zone.radius + rigR;
  }
}
