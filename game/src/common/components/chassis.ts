import { defineComponent } from '@core/component';

/** The two chassis footprints. A size fixes the deck grid AND the engine envelope (below). */
export type ChassisSize = '1x3' | '3x5';

/**
 * The foundation a rig is built on, as a composed product's capability — the chassis counterpart to
 * an engine's `EngineSpec`. Where `EngineSpec` is the summed go of an engine's four sub-parts, a
 * `Chassis` is the summed foundation of its three (wheel/axle, suspension/steering, frame), plus the
 * structural envelope its `size` fixes. A rig carries exactly one; it sits alongside the rig's
 * `MountGrid` (the deck the size also defines) and `Weight`.
 *
 * `size` is the structural choice — it sets the deck dimensions (`MountGrid` cols×rows) and how many
 * engines the deck accepts (`engineMin`..`engineMax`). The 1×3 is a light scout (1–2 engines); the
 * 3×5 a hauler (3–6).
 *
 * `topSpeed` and `turning` are summed from the sub-parts but do NOT affect how the rig drives yet:
 * handling still comes from the rig's constant `Drivetrain`, and propulsion from its engines. They
 * are the seam the future "laden weight" milestone reattaches to (turning → `Drivetrain.turnRate`,
 * topSpeed → a cap on engine-derived top speed). `loadCapacity` is the rig's rated carry weight; the
 * HUD reads it against the live mounted load, but nothing refuses an overload yet.
 */
export interface Chassis {
  size: ChassisSize;
  engineMin: number;
  engineMax: number;
  topSpeed: number;     // summed wheel/axle contribution — not yet consumed by driving
  turning: number;      // summed suspension/steering contribution — not yet consumed by driving
  loadCapacity: number; // summed frame contribution — the rig's rated carry weight (HUD readout)
}

export const Chassis = defineComponent<Chassis>('Chassis');
