import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Drivetrain } from '../components/drivetrain';
import { aggregateEngineOutput } from './engine';
import { totalRigWeight } from './weight';

/**
 * The drive physics in one place: turn a rig's raw engine output and total weight into the
 * performance it actually delivers. Both the movement system (which applies it) and the stat HUD
 * (which shows it) call this, so the numbers can never disagree.
 *
 * Weight resists motion; torque overcomes it. The mobility factor captures that tug-of-war:
 *
 *     mobility = torque / (torque + WEIGHT_DRAG · weight)        ∈ (0, 1]
 *
 * - lots of torque relative to weight → mobility near 1 → the rig moves near its raw potential;
 * - heavy rig, weak torque → mobility falls → sluggish and slow.
 * Effective top speed and acceleration are the raw figures scaled by mobility, so the SAME weight
 * barely dents a high-torque hauler but cripples a low-torque one — which is the whole point of
 * making torque matter. (No engine → torque 0 → mobility 0 → it can't move.)
 *
 * WEIGHT_DRAG is the master tuning knob for "how much weight hurts"; expect to tune it alongside
 * the rig/engine weights in content/.
 */
const WEIGHT_DRAG = 0.5;

export interface RigPerformance {
  power: number;        // raw aggregated engine power (top-speed potential)
  torque: number;       // raw aggregated engine torque (pulling force)
  weight: number;       // total rig weight (chassis + mounted parts)
  mobility: number;     // 0..1 — how much of the raw potential survives the weight
  topSpeed: number;     // effective forward top speed (units/s)
  acceleration: number; // effective acceleration (units/s^2)
  reverse: number;      // effective reverse top speed (units/s)
}

export function rigPerformance(world: World, rig: EntityId): RigPerformance {
  const out = aggregateEngineOutput(world, rig);
  const weight = totalRigWeight(world, rig);
  const reverseFactor = world.get(rig, Drivetrain)?.reverseFactor ?? 0;

  const mobility = out.torque > 0 ? out.torque / (out.torque + WEIGHT_DRAG * weight) : 0;
  const topSpeed = out.power * mobility;
  return {
    power: out.power,
    torque: out.torque,
    weight,
    mobility,
    topSpeed,
    acceleration: out.torque * mobility,
    reverse: topSpeed * reverseFactor,
  };
}
