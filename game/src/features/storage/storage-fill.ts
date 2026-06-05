import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import { Storage } from '@common/components/storage';

/**
 * Storage's sim-driven render: a scrap-coloured block rising inside each open-top container to show
 * how full it is. Like the other animators it READS a sim component (Storage) each frame and drives a
 * view-owned mesh — the World owns the truth (amount/capacity), the block is a disposable projection.
 * Dispatched from the composition root (`main.ts`) so the shared render tier never imports a feature
 * (ADR-003 §4).
 */

// Storage fill block dimensions — kept in step with the cavity in tools/blender/assets/container_shell.py
// (the composed container's host: OUTER 1.0, WALL_T 0.10, CAVITY 0.80, body raised onto FOOT 0.08 feet).
// The block sits just inside the walls, on the cavity floor, and stops below the raised rim collar.
const STORAGE_FLOOR_TOP = 0.16;   // interior floor (BODY_BOT 0.06 + WALL_T 0.10) — the hold rides on feet
const STORAGE_FILL_W = 0.74;      // a touch inside the 0.80 m cavity
const STORAGE_FILL_MAX_H = 0.66;  // full-height of the fill, stopping just below the rim collar
const STORAGE_FILL_EASE = 7;      // how fast the shown level glides to the real fraction (per second)

/**
 * Show how full each storage container is: a scrap-coloured block rising inside the open-top
 * cube. The block is a child of the container group, so it rides, turns, and (for any scaled
 * container) scales along with it for free. Works whether the container is mounted or dropped loose.
 *
 * The level is *eased* toward the Storage fraction rather than snapped: when a piece of scrap lands,
 * amount jumps by a whole unit, but the block glides up to the new level over a few frames so the
 * fill reads as a graceful rise (and drains gracefully too). Purely cosmetic smoothing — the
 * displayed fraction is view state in userData, never game truth.
 */
export function animateStorageFill(views: EntityViews, world: World, dt: number): void {
  for (const [id, obj] of views.objects) {
    const storage = world.isAlive(id) ? world.get(id, Storage) : undefined;
    if (!storage) continue;

    const target = Math.max(0, Math.min(1, storage.amount / storage.capacity));

    let fill = obj.userData['fill'] as THREE.Mesh | undefined;
    if (!fill) {
      // Sized to sit just inside the cavity authored in tools/blender/assets/container_shell.py
      // (0.80 m interior, floor top at STORAGE_FLOOR_TOP). Created at full height; we scale Y to the fraction.
      fill = new THREE.Mesh(
        new THREE.BoxGeometry(STORAGE_FILL_W, STORAGE_FILL_MAX_H, STORAGE_FILL_W),
        new THREE.MeshStandardMaterial({ color: 0x6b6b6b }), // scrap_grey
      );
      obj.add(fill);
      obj.userData['fill'] = fill;
      obj.userData['fillFrac'] = target; // start AT the current level (no spurious rise on spawn)
    }

    // Ease the displayed level toward the real fraction; snap when within a hair to settle it.
    let shown = obj.userData['fillFrac'] as number;
    shown += (target - shown) * Math.min(1, dt * STORAGE_FILL_EASE);
    if (Math.abs(target - shown) < 0.001) shown = target;
    obj.userData['fillFrac'] = shown;

    fill.visible = shown > 0.001;
    fill.scale.y = Math.max(0.0001, shown);
    // Anchor the block's base at the container floor; its top climbs as it fills.
    fill.position.y = STORAGE_FLOOR_TOP + (STORAGE_FILL_MAX_H * shown) / 2;
  }
}
