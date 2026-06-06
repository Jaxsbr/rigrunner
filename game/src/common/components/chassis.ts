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
 * engines the deck accepts (`engineMin`..`engineMax`). The 1×3 is a light scout (1 engine); the
 * 3×5 a hauler (1–3) — capped low on purpose, so engine TIER (not engine count) is the power lever.
 *
 * `grip` and `turning` feed handling: `chassisToRig` derives the rig's `Drivetrain` from them, so a
 * higher-tier chassis handles better (turning → a tighter `Drivetrain.turnRadius`, grip → off-throttle
 * deceleration on top of a constant brake). Propulsion still comes from the engines. `loadCapacity`
 * is the rig's rated carry weight; the HUD reads it against the live mounted load, but nothing
 * refuses an overload yet.
 */
export interface Chassis {
  size: ChassisSize;
  engineMin: number;
  engineMax: number;
  grip: number;         // summed wheel/axle contribution — off-throttle deceleration (via chassisToRig)
  turning: number;      // summed suspension/steering contribution — turn rate (via chassisToRig)
  loadCapacity: number; // summed frame contribution — the rig's rated carry weight (HUD readout)
}

export const Chassis = defineComponent<Chassis>('Chassis');

/**
 * The packed-kit footprint: a built-but-not-yet-deployed chassis stages and is carried as a 2×2
 * block (both sizes), distinct from the unfolded deck it becomes (1×3 / 3×5). The chassis case in
 * `attachCapability` stamps it on the product's `Part`, so mounting reserves the whole 2×2 region on
 * the workshop deck. `chassisToRig` clears it — a rig stands on the ground and is never mounted.
 */
export const CHASSIS_KIT_FOOTPRINT = { cols: 2, rows: 2 } as const;
