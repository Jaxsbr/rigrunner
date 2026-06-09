import { defineComponent } from '@core/component';

/**
 * Boost — a held-Shift overdrive that briefly punches the rig above its normal limits, gated by a
 * HEAT gauge that must cool before it can be used again. The data lives here in the shared kernel
 * because two features read it: the boost system (`@features/boost`) owns the heat logic and writes
 * the surge, and the movement system (`@features/drive`) reads the surge to apply it — keeping the
 * cross-feature dependency one-way (boost → drive), never a cycle.
 *
 * The surge is a FLAT additive bonus, set by the rig's engine TYPE alone (never scaled by tier or
 * engine count), so it's a self-balancing equaliser — a transformative leap for a slow rig, a minor
 * garnish for a fast one, and bounded forever no matter how high tiers climb. The surge SHAPE differs
 * by type (steam = strong-short, electric = weak-long); the boost system resolves it.
 */
export interface Boost {
  /** Current heat, 0 (cold) … HEAT_MAX (redline). Boosting fills it; resting drains it. */
  heat: number;
  /** Latched after a redline: boost is locked out until heat cools all the way back to 0. */
  overheated: boolean;
  /** Whether boost is contributing this frame (held forward, has an engine, not overheated). Sim-set. */
  active: boolean;
  /** Top-speed bonus (u/s) active this frame, 0 when not boosting — movement adds it to the cap. */
  surgeSpeed: number;
  /** Acceleration bonus (u/s²) active this frame, 0 when not boosting. */
  surgeAccel: number;
}

export const Boost = defineComponent<Boost>('Boost');

/** Heat redline. Boosting fills toward it; hitting it overheats and locks boost out until fully cool. */
export const HEAT_MAX = 100;

/** A fresh, cold boost state — what every rig is seeded with. */
export function freshBoost(): Boost {
  return { heat: 0, overheated: false, active: false, surgeSpeed: 0, surgeAccel: 0 };
}

/** Heat as a 0…1 fraction — the HUD bar reads this. */
export function heatFraction(b: Boost): number {
  return Math.max(0, Math.min(1, b.heat / HEAT_MAX));
}
