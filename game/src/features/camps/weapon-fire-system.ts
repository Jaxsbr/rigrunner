import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { Health } from '@common/components/health';
import { facingWithinFov } from '@common/sim/fov';
import { Enemy } from './enemy';
import { Weapon } from './weapon';
import { WEAPON } from './combat';
import { spawnProjectile } from './projectile';

/**
 * The rig's auto-fire weapon. For each weapon part mounted on the rig: tick its cooldown, find the
 * NEAREST living enemy inside the weapon's forward cone + range (the cone is the part's mount facing,
 * read off the Transform the mounting system rides it to — so where you mount the gun is where it can
 * shoot), and if ready, fire a rig-team projectile at that enemy and reset the cooldown. No fire button
 * and no ammo: you "aim" by orienting the rig, exactly as the Reclaimer's dig gate aims its arm.
 *
 * The firing state (`Weapon.cooldownLeft`) is attached lazily the first time a mounted weapon is seen,
 * so a freshly-bought-and-mounted gun needs no special wiring. `rng` is unused (deterministic auto-fire)
 * — kept off the signature; the projectile travels, so missing a mover is the only "randomness".
 */
export function weaponFireSystem(world: World, rig: EntityId, dt: number): void {
  for (const w of world.query(Part, Mount, Transform)) {
    if (world.get(w, Part)!.kind !== 'weapon') continue;
    if (world.get(w, Mount)!.rig !== rig) continue;

    let weapon = world.get(w, Weapon);
    if (!weapon) {
      world.add(w, Weapon, { cooldownLeft: 0, aimYaw: null });
      weapon = world.get(w, Weapon)!;
    }
    weapon.cooldownLeft = Math.max(0, weapon.cooldownLeft - dt);

    const wt = world.get(w, Transform)!;
    let target: EntityId | null = null;
    let best = Infinity;
    for (const e of world.query(Enemy, Transform, Health)) {
      const et = world.get(e, Transform)!;
      const d = Math.hypot(et.x - wt.x, et.z - wt.z);
      if (d > WEAPON.range || d >= best) continue;
      if (!facingWithinFov(wt.x, wt.z, wt.rotationY, et.x, et.z, WEAPON.cone)) continue;
      best = d;
      target = e;
    }

    // Track the target with the barrel even between shots (or rest when none): the animator reads this.
    if (target !== null) {
      const tt = world.get(target, Transform)!;
      weapon.aimYaw = Math.atan2(-(tt.x - wt.x), -(tt.z - wt.z));
    } else {
      weapon.aimYaw = null;
    }

    if (target === null || weapon.cooldownLeft > 0) continue;
    const tt = world.get(target, Transform)!;
    spawnProjectile(world, 'rig', wt.x, wt.z, tt.x, tt.z, WEAPON.projectileSpeed, WEAPON.damage, WEAPON.range);
    weapon.cooldownLeft = WEAPON.cooldown;
  }
}
