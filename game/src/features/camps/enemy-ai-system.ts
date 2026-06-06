import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Health } from '@common/components/health';
import { Enemy, EnemyAI } from './enemy';
import { spawnProjectile } from './projectile';

/** Yaw that points an entity's front (local −Z) at a target — the convention movement/FOV share. */
function yawToward(fromX: number, fromZ: number, toX: number, toZ: number): number {
  return Math.atan2(-(toX - fromX), -(toZ - fromZ));
}

/** Step a Transform toward (tx,tz) by up to `speed·dt`, never overshooting. Returns the new distance. */
function stepToward(t: { x: number; z: number }, tx: number, tz: number, speed: number, dt: number): number {
  const dx = tx - t.x;
  const dz = tz - t.z;
  const d = Math.hypot(dx, dz);
  const step = speed * dt;
  if (d <= step || d === 0) {
    t.x = tx;
    t.z = tz;
    return 0;
  }
  t.x += (dx / d) * step;
  t.z += (dz / d) * step;
  return d - step;
}

/**
 * Drive every guard's state machine + behaviour against the rig (`@features/camps`):
 *   - `GUARD`   — hold post; wake to `ENGAGE` when the rig is within `detection`.
 *   - `ENGAGE`  — face the rig, pursue at `moveSpeed`, fire travelling shots on its `fireInterval`;
 *     break to `RETREAT` when the rig is past `leash` measured FROM THE CAMP (not the post).
 *   - `RETREAT` — fall back to post and resume `GUARD`; re-`ENGAGE` if the rig comes back into reach.
 *
 * Movement is direct Transform stepping (guards aren't rigs — no drivetrain), so this owns their motion.
 * `rng` is unused (deterministic AI); shots travel, so a moving rig dodges. Reads the rig's pose and each
 * enemy's stamped tuning, mutating only enemy Transforms / AI state and the projectiles it fires.
 */
export function enemyAiSystem(world: World, rig: EntityId, dt: number): void {
  const rigT = world.get(rig, Transform);
  if (!rigT) return;

  for (const e of world.query(Enemy, EnemyAI, Transform, Health)) {
    const ai = world.get(e, EnemyAI)!;
    const et = world.get(e, Transform)!;
    const camp = world.get(e, Enemy)!.camp;
    const campT = world.get(camp, Transform);

    const distToRig = Math.hypot(rigT.x - et.x, rigT.z - et.z);
    // Leash is measured from the CAMP — guards defend the camp, not the spot they were standing.
    const campToRig = campT ? Math.hypot(rigT.x - campT.x, rigT.z - campT.z) : distToRig;
    const rigInReach = distToRig <= ai.detection && campToRig <= ai.leash;

    if (ai.state === 'guard') {
      if (rigInReach) ai.state = 'engage';
    } else if (ai.state === 'engage') {
      if (campToRig > ai.leash) ai.state = 'retreat';
    } else {
      // retreat
      if (rigInReach) ai.state = 'engage';
    }

    ai.fireCooldownLeft = Math.max(0, ai.fireCooldownLeft - dt);

    if (ai.state === 'engage') {
      et.rotationY = yawToward(et.x, et.z, rigT.x, rigT.z);
      stepToward(et, rigT.x, rigT.z, ai.moveSpeed, dt);
      if (ai.fireCooldownLeft <= 0) {
        spawnProjectile(world, 'enemy', et.x, et.z, rigT.x, rigT.z, ai.projectileSpeed, ai.damage, ai.detection);
        ai.fireCooldownLeft = ai.fireInterval;
      }
    } else if (ai.state === 'retreat') {
      et.rotationY = yawToward(et.x, et.z, ai.postX, ai.postZ);
      const left = stepToward(et, ai.postX, ai.postZ, ai.moveSpeed, dt);
      if (left === 0) ai.state = 'guard';
    }
  }
}
