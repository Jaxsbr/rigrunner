import type { World } from '../core/world';
import { Transform } from '../components/transform';
import { Engine } from '../components/engine';
import { Velocity } from '../components/velocity';
import { DriveControl } from '../components/drive-control';

/**
 * Integrates throttle/steer intent into motion for every entity that can be driven
 * (has Transform + Engine + Velocity + DriveControl).
 *
 * Pure over the world — state in, state out, no side effects — so it runs and is tested
 * headless. This is the simulation layer; the renderer merely reads the Transform it
 * produces.
 */
export function movementSystem(world: World, dt: number): void {
  for (const e of world.query(Transform, Engine, Velocity, DriveControl)) {
    const t = world.get(e, Transform)!;
    const engine = world.get(e, Engine)!;
    const vel = world.get(e, Velocity)!;
    const ctl = world.get(e, DriveControl)!;

    // Throttle accelerates (or reverses); releasing it lets friction bleed speed to 0.
    if (ctl.throttle !== 0) {
      vel.speed += engine.accel * ctl.throttle * dt;
    } else {
      const drop = Math.min(Math.abs(vel.speed), engine.friction * dt);
      vel.speed -= Math.sign(vel.speed) * drop;
    }
    vel.speed = Math.max(-engine.reverseMax, Math.min(engine.maxSpeed, vel.speed));

    // Steering authority ramps with speed (smoothstep): can't turn a parked rig, and it
    // fades in/out smoothly rather than snapping.
    if (ctl.steer !== 0) {
      const s = Math.min(Math.abs(vel.speed) / engine.turnFullSpeed, 1);
      const authority = s * s * (3 - 2 * s);
      t.rotationY += ctl.steer * engine.turnRate * authority * dt;
    }

    // Advance along the heading (forward = -z).
    t.x += -Math.sin(t.rotationY) * vel.speed * dt;
    t.z += -Math.cos(t.rotationY) * vel.speed * dt;
  }
}
