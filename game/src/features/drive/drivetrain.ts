import { defineComponent } from '@core/component';

/**
 * The chassis side of driving: how the rig HANDLES, independent of how much go it has. Propulsion
 * — top speed and acceleration — no longer lives here; it comes from the engines mounted on the
 * deck (see components/engine-spec.ts + systems/engine.ts). Drivetrain holds only what the chassis
 * owns regardless of which engine is fitted.
 *
 * This split is the point: swap a stronger engine and the rig goes faster without touching the
 * chassis; the rig always has a Drivetrain, but with no engine it has no propulsion and can't move.
 */
export interface Drivetrain {
  friction: number;       // deceleration/s when coasting (or when unpowered)
  turnRate: number;       // rad/s at full steering authority
  turnFullSpeed: number;  // speed at which steering reaches full authority
  reverseFactor: number;  // reverse top speed as a fraction of the engine's forward top speed
}

export const Drivetrain = defineComponent<Drivetrain>('Drivetrain');
