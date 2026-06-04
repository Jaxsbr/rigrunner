import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Drivetrain } from '@features/drive/drivetrain';
import { aggregateEngineOutput } from '@features/engine/engine';

/**
 * The drive physics in one place: turn a rig's aggregated engine output into the performance it
 * delivers. Both the movement system (which applies it) and the stat HUD (which shows it) call this,
 * so the numbers can never disagree.
 *
 * Engine output IS the performance — directly, with no penalty layer:
 *
 *   - top speed     = combined engine power
 *   - acceleration  = combined engine torque
 *   - reverse       = top speed × the chassis's reverseFactor
 *
 * No engine → power/torque 0 → it can't move (throttle is dead; it coasts under friction).
 *
 * Weight is deliberately PARKED. `common/sim/weight.ts → totalRigWeight` still computes a rig's mass,
 * but nothing here consumes it — it is the seam the felt-weight feature (milestone Option A) will
 * reattach to. The earlier "weight drags mobility" tug-of-war that used to scale these figures down
 * is gone, together with the diminishing-returns engine sum it compounded with (see engine.ts):
 * together they made each added engine eventually a net loss, which is exactly the behaviour we
 * pulled out here.
 */

export interface RigPerformance {
  topSpeed: number;     // forward top speed (units/s) = combined engine power
  acceleration: number; // acceleration (units/s^2) = combined engine torque
  reverse: number;      // reverse top speed (units/s) = topSpeed × the chassis's reverseFactor
}

export function rigPerformance(world: World, rig: EntityId): RigPerformance {
  const out = aggregateEngineOutput(world, rig);
  const reverseFactor = world.get(rig, Drivetrain)?.reverseFactor ?? 0;
  return {
    topSpeed: out.power,
    acceleration: out.torque,
    reverse: out.power * reverseFactor,
  };
}
