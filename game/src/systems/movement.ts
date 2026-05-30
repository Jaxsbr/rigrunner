import type { World } from '../core/world';
import { Transform } from '../components/transform';
import { Drivetrain } from '../components/drivetrain';
import { Velocity } from '../components/velocity';
import { DriveControl } from '../components/drive-control';
import { rigPerformance } from './drive';

/**
 * Integrates throttle/steer intent into motion for every entity that can be driven
 * (has Transform + Drivetrain + Velocity + DriveControl).
 *
 * Propulsion comes from the rig's engines, weighed down by its total mass — both resolved by
 * rigPerformance (systems/drive.ts). A stronger engine drives faster and accelerates harder, two
 * engines beat one (with diminishing returns), and a heavier rig is slower unless its torque keeps
 * up. A rig with NO engine has zero output: throttle is dead and it coasts to rest under friction —
 * the "I built a rig but forgot the engine" teaching moment, felt directly in the controls.
 *
 * Pure over the world — state in, state out, no side effects — so it runs and is tested headless.
 */
export function movementSystem(world: World, dt: number): void {
  for (const e of world.query(Transform, Drivetrain, Velocity, DriveControl)) {
    const t = world.get(e, Transform)!;
    const drive = world.get(e, Drivetrain)!;
    const vel = world.get(e, Velocity)!;
    const ctl = world.get(e, DriveControl)!;

    const perf = rigPerformance(world, e);

    // Throttle accelerates (or reverses) only while there's propulsion; otherwise — and whenever
    // throttle is released — friction bleeds speed to 0.
    if (perf.topSpeed > 0 && ctl.throttle !== 0) {
      vel.speed += perf.acceleration * ctl.throttle * dt;
    } else {
      const drop = Math.min(Math.abs(vel.speed), drive.friction * dt);
      vel.speed -= Math.sign(vel.speed) * drop;
    }
    vel.speed = Math.max(-perf.reverse, Math.min(perf.topSpeed, vel.speed));

    // Steering authority ramps with speed (smoothstep): can't turn a parked rig, and it
    // fades in/out smoothly rather than snapping.
    if (ctl.steer !== 0) {
      const s = Math.min(Math.abs(vel.speed) / drive.turnFullSpeed, 1);
      const authority = s * s * (3 - 2 * s);
      t.rotationY += ctl.steer * drive.turnRate * authority * dt;
    }

    // Advance along the heading (forward = -z).
    t.x += -Math.sin(t.rotationY) * vel.speed * dt;
    t.z += -Math.cos(t.rotationY) * vel.speed * dt;
  }
}
