import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Chassis } from '@common/components/chassis';
import { chassisTier } from '@common/sim/assembly';
import { tierOf } from '@common/parts/tiers';

/**
 * The chassis defence envelope per size — the base hit points a freshly-deployed rig carries before
 * the tier multiplier. The chassis is the rig's body, so a bigger chassis tanks more: the 1×3 scout is
 * the baseline, the 3×5 hauler a larger but sturdier target. Build-time tuning numbers.
 */
const CHASSIS_BASE_HEALTH: Record<string, number> = {
  '1x3': 100,
  '3x5': 160,
};

/**
 * The rig's maximum hit points — the chassis base scaled by the chassis's grade (its Frame tier, the
 * same finish the rig wears), so a better chassis tanks more exactly as a better chassis turns sharper.
 * Aggregated here (not stored on the chassis spec) so it stays the SINGLE max-health point: the day
 * armour / shield PARTS land they add their contribution here — sum mounted armour-part Health onto the
 * chassis base — and the HUD bar and repair clamp pick it up with no other change. (No such part exists
 * yet; this is the seam, not a built mechanic.)
 */
export function rigMaxHealth(world: World, rig: EntityId): number {
  const size = world.get(rig, Chassis)?.size;
  const base = (size && CHASSIS_BASE_HEALTH[size]) ?? CHASSIS_BASE_HEALTH['1x3']!;
  const tier = chassisTier(world, rig);
  const mult = tier ? tierOf(tier).mult : 1;
  return Math.round(base * mult);
}
