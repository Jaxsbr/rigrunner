import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import type { CollisionPair } from '@common/sim/collision';
import { Mount } from '@common/components/mount';
import { Health } from '@common/components/health';
import { Enemy } from './enemy';
import { Projectile } from './projectile';

/**
 * Resolve combat contacts from this frame's collision pairs — the consumer side of the shared
 * `@common/sim/collision` finder (the second consumer that earned its promotion). Two outcomes:
 *   - **Projectile hit.** A shot damages only the OTHER team: a rig shot that touches an enemy damages
 *     it (and dies); an enemy shot that touches the rig BODY damages the rig (and dies). No friendly
 *     fire, so a shot harmlessly overlaps its own firer the frame it spawns.
 *   - **Ram.** The rig body meeting an enemy instantly kills the enemy (no rig self-damage in Phase 1).
 *
 * An enemy at 0 HP is destroyed here; the RIG at 0 HP is left for `main` to turn into the run reset, so
 * combat never reaches into the boot/reset concern. Reads the same pair list scrap collection reads —
 * `main` finds pairs once and hands them to both.
 */

/** Is `id` part of the rig — the chassis itself, or any part mounted on it? The whole rig is the target. */
function isRigBody(world: World, id: EntityId, rig: EntityId): boolean {
  if (id === rig) return true;
  return world.get(id, Mount)?.rig === rig;
}

/** Lower a thing's Health; destroy it at 0 only when asked (enemies die here, the rig resets in main). */
function applyDamage(world: World, id: EntityId, amount: number, destroyOnDeath: boolean): void {
  const h = world.get(id, Health);
  if (!h) return;
  h.current -= amount;
  if (destroyOnDeath && h.current <= 0) world.destroyEntity(id);
}

export function combatSystem(world: World, rig: EntityId, pairs: readonly CollisionPair[]): void {
  for (const { a, b } of pairs) {
    if (!world.isAlive(a) || !world.isAlive(b)) continue; // a prior pair this frame may have destroyed one

    const aIsProj = world.has(a, Projectile);
    const bIsProj = world.has(b, Projectile);
    if (aIsProj && bIsProj) continue; // two shots crossing — they don't interact

    if (aIsProj || bIsProj) {
      const proj = aIsProj ? a : b;
      const other = aIsProj ? b : a;
      const shot = world.get(proj, Projectile)!;
      if (shot.team === 'rig' && world.has(other, Enemy)) {
        applyDamage(world, other, shot.damage, true);
        world.destroyEntity(proj);
      } else if (shot.team === 'enemy' && isRigBody(world, other, rig)) {
        applyDamage(world, rig, shot.damage, false);
        world.destroyEntity(proj);
      }
      continue;
    }

    // Ram: the rig body driving into an enemy — instant kill, no rig self-damage (Phase 1).
    if (world.has(a, Enemy) && isRigBody(world, b, rig)) world.destroyEntity(a);
    else if (world.has(b, Enemy) && isRigBody(world, a, rig)) world.destroyEntity(b);
  }
}
