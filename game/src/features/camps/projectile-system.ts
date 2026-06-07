import type { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Projectile } from './projectile';

/**
 * Advance every projectile along its velocity and retire it when its time-to-live runs out. Purely the
 * travel half of combat — hits are resolved separately (`combatSystem`, over the shared collision
 * pairs), so a shot that reaches nothing simply expires here. Planar motion (x/z); the tracer's height
 * is fixed at spawn. Mutates only the projectiles it owns, so it runs and tests headless.
 */
export function projectileMoveSystem(world: World, dt: number): void {
  for (const p of world.query(Projectile, Transform)) {
    const proj = world.get(p, Projectile)!;
    proj.ttl -= dt;
    if (proj.ttl <= 0) {
      world.destroyEntity(p);
      continue;
    }
    const t = world.get(p, Transform)!;
    t.x += proj.vx * dt;
    t.z += proj.vz * dt;
  }
}
