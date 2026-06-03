import * as THREE from 'three';
import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { WorkshopZone } from '../components/workshop-zone';
import { ScrapPile } from '../components/scrap-pile';

/**
 * Proximity-zone discs: one flat circle under each gated interaction (a workshop, a scrap pile),
 * coloured by its gate state. Pure view polish (a projection of the `active` flag the sim owns) —
 * lit green when the interaction is available and dim grey otherwise, so the "you can act now" state
 * is unmistakable. The same disc reads identically for the workshop and the pile, on purpose: a lit
 * ring means "park here and go". Discs are created lazily on first sight and dropped when their
 * owner is gone (a pile is destroyed when emptied).
 */
export class ZoneOverlays {
  private readonly discs = new Map<EntityId, THREE.Mesh>();

  constructor(private readonly scene: THREE.Scene) {}

  sync(world: World): void {
    for (const e of world.query(WorkshopZone, Transform)) {
      const z = world.get(e, WorkshopZone)!;
      this.upsert(world, e, z.radius, z.active);
    }
    for (const e of world.query(ScrapPile, Transform)) {
      const p = world.get(e, ScrapPile)!;
      this.upsert(world, e, p.radius, p.active);
    }

    // Drop discs for any owner that no longer exists.
    for (const [id, disc] of this.discs) {
      if (!world.isAlive(id)) {
        this.scene.remove(disc);
        this.discs.delete(id);
      }
    }
  }

  /** Create-or-update the disc for one gated entity, sized to its radius and tinted by `active`. */
  private upsert(world: World, e: EntityId, radius: number, active: boolean): void {
    let disc = this.discs.get(e);
    if (!disc) {
      // Sized to the zone radius once (radius is fixed) and reused thereafter.
      disc = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 48),
        new THREE.MeshBasicMaterial({ color: 0x59ff9f, transparent: true, opacity: 0.18 }),
      );
      disc.rotation.x = -Math.PI / 2;
      this.scene.add(disc);
      this.discs.set(e, disc);
    }
    const t = world.get(e, Transform)!;
    disc.position.set(t.x, 0.03, t.z); // just above the ground plane to avoid z-fighting
    const mat = disc.material as THREE.MeshBasicMaterial;
    mat.color.setHex(active ? 0x59ff9f : 0x6f685c); // glow_green active, dim grey dormant
    mat.opacity = active ? 0.28 : 0.14;
  }
}
