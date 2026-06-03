import * as THREE from 'three';
import type { EntityId } from '@core/types';

/**
 * Proximity-zone discs: one flat green circle under each gated interaction, shown ONLY while it is
 * available. A dormant zone draws nothing at all (the structure — the heap, the workshop — is
 * self-evident, so an idle ring just clutters the ground and covers the scrap stains); the instant a
 * gate lights, a translucent green disc appears = "park here and go". The same disc reads identically
 * for every gated thing, on purpose.
 *
 * This is generic render INFRASTRUCTURE (ADR-003 §4): it knows nothing about which feature a disc
 * belongs to. Each feature contributes its discs as a plain `ZoneDisc[]` (see `features/<x>/overlays`)
 * and `main.ts` concatenates them and calls `sync` — so the shared render tier never imports a
 * feature. Discs are created lazily on first sight and dropped when their owner stops appearing in
 * the entry list (e.g. a pile destroyed when emptied).
 *
 * The disc sits BELOW the scrap stains and writes no depth, so an active ring composites under any
 * seepage stain rather than punching a hole in it.
 */
export interface ZoneDisc {
  id: EntityId;
  x: number;
  z: number;
  radius: number;
  active: boolean;
}

export class ZoneOverlays {
  private readonly discs = new Map<EntityId, THREE.Mesh>();

  constructor(private readonly scene: THREE.Scene) {}

  /** Reconcile the disc set with this frame's gated entries: upsert each, drop any that vanished. */
  sync(entries: readonly ZoneDisc[]): void {
    const seen = new Set<EntityId>();
    for (const e of entries) {
      seen.add(e.id);
      this.upsert(e);
    }
    // Drop discs for any owner that no longer appears (destroyed, or its gate component removed).
    for (const [id, disc] of this.discs) {
      if (!seen.has(id)) {
        this.scene.remove(disc);
        this.discs.delete(id);
      }
    }
  }

  /** Create-or-update the disc for one gated entity, sized to its radius and tinted by `active`. */
  private upsert(e: ZoneDisc): void {
    let disc = this.discs.get(e.id);
    if (!disc) {
      // Sized to the zone radius once (radius is fixed) and reused thereafter. depthWrite off + a y
      // just under the stains (≈0.02) so an active disc never occludes a seepage stain inside it.
      disc = new THREE.Mesh(
        new THREE.CircleGeometry(e.radius, 48),
        new THREE.MeshBasicMaterial({ color: 0x59ff9f, transparent: true, opacity: 0.25, depthWrite: false }),
      );
      disc.rotation.x = -Math.PI / 2;
      this.scene.add(disc);
      this.discs.set(e.id, disc);
    }
    disc.position.set(e.x, 0.012, e.z); // below the scrap stains; above the ground/grid
    disc.visible = e.active; // fully transparent (drawn nothing) when dormant; green ring when lit
  }
}
