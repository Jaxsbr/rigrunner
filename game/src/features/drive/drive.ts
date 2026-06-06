import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Drivetrain } from '@features/drive/drivetrain';
import { aggregateEngineOutput } from '@features/engine/engine';
import { effectiveRigWeight } from '@common/sim/weight';

/**
 * The drive physics in one place: turn a rig's aggregated engine output AND its weight into the
 * performance it delivers. Both the movement system (which applies it) and the stat HUD (which shows
 * it) call this, so the numbers can never disagree.
 *
 * Weight resists motion; torque overcomes it. The mobility factor captures that tug-of-war:
 *
 *     mobility = torque / (torque + WEIGHT_DRAG · weight)        ∈ (0, 1]
 *
 *   - top speed     = combined engine power × mobility
 *   - acceleration  = combined engine torque × mobility
 *   - reverse       = top speed × the chassis's reverseFactor
 *
 * `weight` is the rig's EFFECTIVE weight (dry structural mass + live cargo — see
 * `common/sim/weight.ts → effectiveRigWeight`), so a rig loaded with scrap is heavier, hauls a lower
 * mobility, and is slower and slower to respond than the same rig empty — collecting has a felt cost.
 * Because torque is what fights weight, the SAME cargo barely dents a high-torque steam hauler but
 * noticeably slows a low-torque electric runner — the energy-type identity becomes a hauling identity.
 *
 * No engine → power/torque 0 → mobility 0 → it can't move (throttle is dead; it coasts under friction).
 *
 * Engines still sum linearly (see engine.ts) and more engines are always more performance: each adds
 * weight, but its torque raises mobility enough that the net is a strict gain — the old
 * diminishing-returns sum that once made the 4th–6th engine a net loss is gone, so reattaching weight
 * here does not bring that back.
 *
 * WEIGHT_DRAG is the master tuning knob for "how much weight hurts"; expect to tune it to feel
 * alongside the part/engine weights and `SCRAP_UNIT_WEIGHT` in content/`common/sim/weight.ts`.
 */
const WEIGHT_DRAG = 0.5;

export interface RigPerformance {
  topSpeed: number;     // forward top speed (units/s) = combined engine power × mobility
  acceleration: number; // acceleration (units/s^2) = combined engine torque × mobility
  reverse: number;      // reverse top speed (units/s) = topSpeed × the chassis's reverseFactor
}

export function rigPerformance(world: World, rig: EntityId): RigPerformance {
  const out = aggregateEngineOutput(world, rig);
  const weight = effectiveRigWeight(world, rig);
  const reverseFactor = world.get(rig, Drivetrain)?.reverseFactor ?? 0;

  const mobility = out.torque > 0 ? out.torque / (out.torque + WEIGHT_DRAG * weight) : 0;
  const topSpeed = out.power * mobility;
  return {
    topSpeed,
    acceleration: out.torque * mobility,
    reverse: topSpeed * reverseFactor,
  };
}
