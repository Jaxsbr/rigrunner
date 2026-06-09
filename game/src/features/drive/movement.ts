import type { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Drivetrain } from '@features/drive/drivetrain';
import { Velocity } from '@features/drive/velocity';
import { DriveControl } from '@features/drive/drive-control';
import { Boost } from '@common/components/boost';
import { rigPerformance } from './drive';
import { steeringPivotLz } from './steering';

/**
 * Integrates throttle/steer intent into motion for every entity that can be driven
 * (has Transform + Drivetrain + Velocity + DriveControl).
 *
 * Propulsion comes from the rig's engines, resolved by rigPerformance (drive.ts): top speed is capped
 * by the chassis ceiling, and engines compound with diminishing returns. Weight drags on that output
 * (rigPerformance's mobility factor), so a rig laden with cargo is slower and slower to respond than
 * the same rig empty. A rig with NO engine has zero output: throttle is dead and it coasts to rest
 * under friction — the "I built a rig but forgot the engine" teaching moment, felt in the controls.
 *
 * Boost (set by the boost system on the rig's `Boost`) briefly lifts the forward cap ABOVE the ceiling
 * and adds an acceleration surge — a flat bonus, so it transforms a slow rig and barely flatters a
 * fast one. When boost ends, the over-cap speed coasts down under friction rather than snapping back.
 *
 * Steering combines three effects: the applied steer RAMPS toward the input (STEER_RAMP) so a hard
 * turn builds up rather than snapping 0→full; a turning-RADIUS model (yaw ∝ speed, so the rig arcs
 * through a fixed-radius circle like a real vehicle instead of pivoting on the spot); taken about an
 * engine-set longitudinal PIVOT (steering.ts) — where the engines sit decides whether the nose sweeps
 * wide (rear drive), the tail kicks out (front drive), or it turns about its centre (centred drive).
 *
 * Pure over the world — state in, state out, no side effects — so it runs and is tested headless.
 */
// How fast the applied steer ramps toward the input, per second — full lock reached in ~1/STEER_RAMP s,
// so a turn builds up and eases out rather than snapping on/off. Tunable to feel.
const STEER_RAMP = 3; // ≈ 0.33s from straight to full lock

export function movementSystem(world: World, dt: number): void {
  for (const e of world.query(Transform, Drivetrain, Velocity, DriveControl)) {
    const t = world.get(e, Transform)!;
    const drive = world.get(e, Drivetrain)!;
    const vel = world.get(e, Velocity)!;
    const ctl = world.get(e, DriveControl)!;

    const perf = rigPerformance(world, e);

    // Boost (set by the boost system) raises the forward cap above the chassis ceiling and adds an
    // acceleration surge — both flat, both forward-only (the boost system zeroes them otherwise).
    const boost = world.get(e, Boost);
    const boosting = !!(boost && boost.active);
    const cap = perf.topSpeed + (boosting ? boost!.surgeSpeed : 0);
    const accel = perf.acceleration + (boosting ? boost!.surgeAccel : 0);

    // Throttle drives toward the (possibly boosted) cap; reverse toward the reverse cap; otherwise
    // friction bleeds speed to 0. The engine never forces speed DOWN, so speed carried above the cap
    // (a boost that just ended) coasts off under friction below rather than snapping to the cap.
    if (perf.topSpeed > 0 && ctl.throttle > 0) {
      if (vel.speed < cap) vel.speed = Math.min(cap, vel.speed + accel * ctl.throttle * dt);
    } else if (perf.topSpeed > 0 && ctl.throttle < 0) {
      if (vel.speed > -perf.reverse) {
        vel.speed = Math.max(-perf.reverse, vel.speed + perf.acceleration * ctl.throttle * dt);
      }
    } else {
      const drop = Math.min(Math.abs(vel.speed), drive.friction * dt);
      vel.speed -= Math.sign(vel.speed) * drop;
    }
    // Boost momentum: speed above the current cap bleeds off under friction (a smooth fade after a
    // boost ends), and the reverse floor is held — forward over-cap is the intended coast-down.
    if (vel.speed > cap) vel.speed = Math.max(cap, vel.speed - drive.friction * dt);
    if (vel.speed < -perf.reverse) vel.speed = -perf.reverse;

    // Steering = a turning-RADIUS model, taken about an engine-set PIVOT:
    //  • yaw rate is proportional to forward speed (yaw = speed / turnRadius), so the rig ARCS through
    //    a fixed-radius circle like a real vehicle instead of pivoting on the spot — standing still it
    //    can't turn, faster travels the same circle quicker, reverse flips the arc.
    //  • it turns about a longitudinal pivot set by where the engines sit (steeringPivotLz): a rear
    //    drive plants the back and sweeps the nose, a front drive kicks the tail out, a centred/absent
    //    pivot (0) turns about the origin. Where you bolt the engine changes how the rig handles.
    // Ramp the APPLIED steer toward the input at a limited rate (STEER_RAMP/s), so a hard turn builds
    // up instead of snapping 0→full and eases back out when released. The yaw + pivot use this smoothed
    // value, not the raw key state. (appliedSteer is sim state on DriveControl, never written by input.)
    const prevSteer = ctl.appliedSteer ?? 0;
    const maxStep = STEER_RAMP * dt;
    const steer = prevSteer + Math.max(-maxStep, Math.min(maxStep, ctl.steer - prevSteer));
    ctl.appliedSteer = steer;

    if (steer !== 0) {
      const before = t.rotationY;
      t.rotationY += steer * (vel.speed / drive.turnRadius) * dt;

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
