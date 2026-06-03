import * as THREE from 'three';
import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { WorkshopZone } from '../components/workshop-zone';
import { ScrapPile } from '../components/scrap-pile';

/**
 * Proximity-zone discs: one flat circle under each gated interaction (a workshop, a scrap pile),
 * shown ONLY while the interaction is available. A dormant zone draws nothing at all (the structure
 * itself — the heap, the workshop — is self-evident, so an idle ring just clutters the ground and
 * covers the scrap stains); the instant the gate lights, a translucent green disc appears = "park
 * here and go". The same disc reads identically for the workshop and the pile, on purpose. Discs are
 * created lazily on first sight and dropped when their owner is gone (a pile is destroyed when emptied).
 *
 * The disc sits BELOW the scrap stains and writes no depth, so an active ring composites under any
 * seepage stain rather than punching a hole in it.
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
      // Sized to the zone radius once (radius is fixed) and reused thereafter. depthWrite off + a y
      // just under the stains (≈0.02) so an active disc never occludes a seepage stain inside it.
      disc = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 48),
        new THREE.MeshBasicMaterial({ color: 0x59ff9f, transparent: true, opacity: 0.25, depthWrite: false }),
      );
      disc.rotation.x = -Math.PI / 2;
      this.scene.add(disc);
      this.discs.set(e, disc);
    }
    const t = world.get(e, Transform)!;
    disc.position.set(t.x, 0.012, t.z); // below the scrap stains; above the ground/grid
    disc.visible = active; // fully transparent (drawn nothing) when dormant; green ring when lit
  }
}
