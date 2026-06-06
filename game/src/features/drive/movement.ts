import type { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Drivetrain } from '@features/drive/drivetrain';
import { Velocity } from '@features/drive/velocity';
import { DriveControl } from '@features/drive/drive-control';
import { rigPerformance } from './drive';
import { steeringPivotLz } from './steering';

/**
 * Integrates throttle/steer intent into motion for every entity that can be driven
 * (has Transform + Drivetrain + Velocity + DriveControl).
 *
 * Propulsion comes from the rig's engines, resolved by rigPerformance (drive.ts). A stronger engine
 * drives faster and accelerates harder, and engines sum linearly — two beat one, six give the most,
 * with no diminishing-returns cliff. Weight drags on that output (rigPerformance's mobility factor),
 * so a rig laden with cargo is slower and slower to respond than the same rig empty. A rig with NO
 * engine has zero output: throttle is dead and it coasts to rest under friction — the "I built a rig
 * but forgot the engine" teaching moment, felt directly in the controls.
 *
 * Steering combines two effects: a turning-RADIUS model (yaw ∝ speed, so the rig arcs through a
 * fixed-radius circle like a real vehicle instead of pivoting on the spot), taken about an engine-set
 * longitudinal PIVOT (steering.ts) — where the engines sit decides whether the nose sweeps wide (rear
 * drive), the tail kicks out (front drive), or it turns about its centre (centred drive).
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

    // Steering = a turning-RADIUS model, taken about an engine-set PIVOT:
    //  • yaw rate is proportional to forward speed (yaw = speed / turnRadius), so the rig ARCS through
    //    a fixed-radius circle like a real vehicle instead of pivoting on the spot — standing still it
    //    can't turn, faster travels the same circle quicker, reverse flips the arc.
    //  • it turns about a longitudinal pivot set by where the engines sit (steeringPivotLz): a rear
    //    drive plants the back and sweeps the nose, a front drive kicks the tail out, a centred/absent
    //    pivot (0) turns about the origin. Where you bolt the engine changes how the rig handles.
    if (ctl.steer !== 0) {
      const before = t.rotationY;
      t.rotationY += ctl.steer * (vel.speed / drive.turnRadius) * dt;

      // Hold the engine-set pivot (pivotLz along local Z) fixed through the yaw change by shifting the
      // origin to compensate. A centred/absent pivot (0) leaves the origin put — turn about centre.
      const pivotLz = steeringPivotLz(world, e);
      if (pivotLz !== 0) {
        t.x += pivotLz * (Math.sin(before) - Math.sin(t.rotationY));
        t.z += pivotLz * (Math.cos(before) - Math.cos(t.rotationY));
      }
    }

    // Advance along the heading (forward = -z).
    t.x += -Math.sin(t.rotationY) * vel.speed * dt;
    t.z += -Math.cos(t.rotationY) * vel.speed * dt;
  }
}
