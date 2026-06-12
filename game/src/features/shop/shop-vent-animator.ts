import type * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import { WorldShop } from './world-shop';

/**
 * The shop's ambient render: lazily spin each shopfront's roof ventilator (the `joint_vent` whirlybird
 * node in the GLB) about its vertical axis. A turning vent reads "this place is occupied / open for
 * trade" from across the bowl, giving the silhouette life. It owns no game truth — a constant idle
 * rotation off the frame's `dt`, dispatched from the composition root (ADR-003 §4) so the shared render
 * tier never imports a feature. Run always (even while an overlay freezes the sim), like the other
 * ambient animators, so the vent keeps turning behind the shop interface rather than snapping on resume.
 */

/** Idle spin speed in rad/s — a lazy whirlybird turn, not a fast fan. */
const VENT_SPEED = 0.9;

export function animateShopVents(views: EntityViews, world: World, dt: number): void {
  // Iterate the few shops, not every renderable object in the scene — then look up each shop's Object3D.
  for (const id of world.query(WorldShop)) {
    const obj = views.objects.get(id);
    if (!obj) continue;
    // Locate the vent node once the GLB has loaded, then cache it. Until it's found (the model loads
    // async) we keep looking — caching a premature null would freeze the vent forever.
    let vent = obj.userData['shopVent'] as THREE.Object3D | null | undefined;
    if (!vent) {
      vent = obj.getObjectByName('joint_vent') ?? null;
      if (vent) obj.userData['shopVent'] = vent;
    }
    if (!vent) continue;
    vent.rotation.y += VENT_SPEED * dt;
  }
}
