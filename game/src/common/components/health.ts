import { defineComponent } from '@core/component';

/**
 * A thing's hit points. The rig carries one (its `max` is the chassis's defence envelope — see
 * `@common/sim/health`); each camp enemy carries its own, so they're cleared one at a time. It is its
 * OWN component, not a chassis or enemy field, so the one damage path (`@common/sim/collision` →
 * projectile/ram hits in `features/camps`) lowers `current` on rig and enemy through the same code.
 *
 * `current` falls with damage and rises with repair (free in a workshop zone); it never exceeds `max`.
 * At `current ≤ 0` the thing is dead — an enemy is destroyed, the rig resets to the boot seed.
 */
export interface Health {
  current: number;
  max: number;
}

export const Health = defineComponent<Health>('Health');
