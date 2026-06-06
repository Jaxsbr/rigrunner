import * as THREE from 'three';
import type { World } from '@core/world';
import type { EntityViews } from '@common/render/entity-views';
import { Transform } from '@common/components/transform';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { Weapon } from './weapon';
import { WEAPON } from './combat';

/**
 * The weapon's sim-driven render: swivel each mounted gun's `barrel` node to track the target it's
 * firing on. It READS the sim's `Weapon.aimYaw` (the world yaw toward the nearest in-cone enemy, set by
 * the fire system) and eases the barrel's LOCAL yaw toward (aim − mount-facing), clamped to the cone so
 * it never points past where the gun can shoot; with no target it eases back to rest (straight ahead).
 *
 * Pure view polish — it owns only the eased barrel angle, mutating nothing in the sim. The barrel node
 * is found by name within the weapon's model (cached once it loads); a model without one (the grey-box
 * placeholder before the GLB lands) simply no-ops. Dispatched from `main.ts` (ADR-003 §4).
 */

const SWIVEL_RATE = 8; // how fast the barrel eases toward its target angle (radians/s-ish blend)

export function animateWeapons(views: EntityViews, world: World, dt: number): void {
  for (const w of world.query(Part, Mount, Weapon, Transform)) {
    if (world.get(w, Part)!.kind !== 'weapon') continue;
    const obj = views.get(w);
    if (!obj) continue;

    // Find + cache the barrel node once the model loads; null until then (placeholder no-ops).
    let barrel = obj.userData['barrel'] as THREE.Object3D | null | undefined;
    if (barrel === undefined || barrel === null) {
      barrel = obj.getObjectByName('barrel') ?? null;
      if (barrel) obj.userData['barrel'] = barrel;
    }
    if (!barrel) continue;

    const weapon = world.get(w, Weapon)!;
    const mountYaw = world.get(w, Transform)!.rotationY;
    // Target local yaw: aim minus the mount facing, clamped into the cone; rest (0) when no target.
    let want = 0;
    if (weapon.aimYaw !== null) {
      const half = WEAPON.cone / 2;
      const delta = normalizeAngle(weapon.aimYaw - mountYaw);
      want = Math.max(-half, Math.min(half, delta));
    }
    const k = Math.min(1, dt * SWIVEL_RATE);
    barrel.rotation.y += (want - barrel.rotation.y) * k;
  }
}

/** Wrap an angle to (−π, π] so the barrel takes the short way round. */
function normalizeAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
