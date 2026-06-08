import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Drivetrain } from '@features/drive/drivetrain';
import { Chassis } from '@common/components/chassis';
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
 *   - top speed     = min(chassis ceiling, combined engine power × mobility)
 *   - acceleration  = combined engine torque × mobility
 *   - reverse       = top speed × the chassis's reverseFactor
 *
 * The chassis CEILING (`Chassis.topSpeed`, summed from the wheel/axle running gear) caps the top end:
 * engines and tiers determine how fast the rig reaches that ceiling and how well it holds it under
 * load, but never let it exceed it — so the running gear, not the engine, sets a rig's ultimate top
 * speed, and future high-tier engines can't break the map. Acceleration is left uncapped (the surge a
 * boost lifts further); a rig without a `Chassis` (a bare test rig) simply has no ceiling.
 *
 * `weight` is the rig's EFFECTIVE weight (dry structural mass + live cargo — see
 * `common/sim/weight.ts → effectiveRigWeight`), so a rig loaded with scrap is heavier, hauls a lower
 * mobility, and is slower and slower to respond than the same rig empty — collecting has a felt cost.
 * Because torque is what fights weight, the SAME cargo barely dents a high-torque steam hauler but
 * noticeably slows a low-torque electric runner — the energy-type identity becomes a hauling identity.
 *
 * No engine → power/torque 0 → mobility 0 → it can't move (throttle is dead; it coasts under friction).
 *
 * Engines compound with DIMINISHING RETURNS (see engine.ts): each adds weight, but its (sub-linear)
 * torque still raises mobility enough that every extra engine is a net gain. Capping count low (the
 * 3×5 takes two) keeps a laden hauler below its ceiling — "strong but never truly fast" — which is the
 * gap a boost exists to fill.
 *
 * WEIGHT_DRAG is the master tuning knob for "how much weight hurts"; expect to tune it to feel
 * alongside the part/engine weights and `SCRAP_UNIT_WEIGHT` in content/`common/sim/weight.ts`.
 *
 * Absolute pace (how fast the whole game moves) is tuned at the source — the engines' own
 * power/torque in `common/parts/parts-catalog.ts` — NOT by a global multiplier here. Lower the
 * catalog numbers to slow everything down; this file only resolves engine output against weight.
 */
const WEIGHT_DRAG = 0.7;

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
  // The chassis ceiling caps the top end; a rig with no Chassis (a bare test rig) has no cap.
  const ceiling = world.get(rig, Chassis)?.topSpeed;
  const driven = out.power * mobility;
  const topSpeed = ceiling !== undefined ? Math.min(ceiling, driven) : driven;
  return {
    topSpeed,
    acceleration: out.torque * mobility,
    reverse: topSpeed * reverseFactor,
  };
}
