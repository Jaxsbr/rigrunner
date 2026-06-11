import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { WorldShop } from './world-shop';

/**
 * Recompute each world shop's proximity gate: a `WorldShop` is `active` while the player's rig is
 * intersecting its circle, dormant otherwise. The shop interface reads this to decide when its tab
 * shows / E opens it; the render layer reads it to light the zone disc. Mirrors `workshopZoneSystem`.
 *
 * Intersection is circle-vs-circle — the rig's collider overlapping the zone — so parking the rig
 * beside the shopfront counts, not just driving its centre onto the marker:
 *   distance(rig, shop) ≤ zone.radius + rigColliderRadius.
 *
 * Pure over the World (one boolean write per shop), so it runs and tests headless.
 */
export function shopZoneSystem(world: World, rig: EntityId): void {
  const rigT = world.get(rig, Transform);
  const rigR = world.get(rig, Collider)?.radius ?? 0;

  for (const s of world.query(WorldShop, Transform)) {
    const shop = world.get(s, WorldShop)!;
    if (!rigT) {
      shop.active = false;
      continue;
    }
    const st = world.get(s, Transform)!;
    const d = Math.hypot(st.x - rigT.x, st.z - rigT.z);
    shop.active = d <= shop.radius + rigR;
  }
}
