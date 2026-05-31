import * as THREE from 'three';
import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { WorkshopZone } from '../components/workshop-zone';

/**
 * Workshop proximity-zone discs: one flat circle under each workshop, coloured by its gate state.
 * Pure view polish (a projection of the WorkshopZone flag the sim owns) — lit green when the rig is
 * in range and dim grey otherwise, so the "you can transfer now" state is unmistakable. Discs are
 * created lazily on first sight and dropped when their workshop is gone.
 */
export class ZoneOverlays {
  private readonly discs = new Map<EntityId, THREE.Mesh>();

  constructor(private readonly scene: THREE.Scene) {}

  sync(world: World): void {
    for (const e of world.query(WorkshopZone, Transform)) {
      const zone = world.get(e, WorkshopZone)!;
      let disc = this.discs.get(e);
      if (!disc) {
        // Sized to the zone radius once (radius is fixed) and reused thereafter.
        disc = new THREE.Mesh(
          new THREE.CircleGeometry(zone.radius, 48),
          new THREE.MeshBasicMaterial({ color: 0x59ff9f, transparent: true, opacity: 0.18 }),
        );
        disc.rotation.x = -Math.PI / 2;
        this.scene.add(disc);
        this.discs.set(e, disc);
      }
      const t = world.get(e, Transform)!;
      disc.position.set(t.x, 0.03, t.z); // just above the ground plane to avoid z-fighting
      const mat = disc.material as THREE.MeshBasicMaterial;
      mat.color.setHex(zone.active ? 0x59ff9f : 0x6f685c); // glow_green active, dim grey dormant
      mat.opacity = zone.active ? 0.28 : 0.14;
    }

    // Drop discs for any workshop that no longer exists.
    for (const [id, disc] of this.discs) {
      if (!world.isAlive(id)) {
        this.scene.remove(disc);
        this.discs.delete(id);
      }
    }
  }
}
