import { defineComponent } from '@core/component';

/**
 * The camp objective's lifecycle. `GUARDED` while any guard lives (trap armed, stains present) →
 * `DISARMABLE` once all guards are cleared → `CLEARED` once disarmed (loot granted, stains begin
 * fading, a restorable site emitted). Loot is gated on BOTH all-enemies-cleared AND a non-fail disarm.
 *
 * In Phase 1 there is no trap arm yet, so disarm is STUBBED to auto-success: the camp passes through
 * `DISARMABLE` to `CLEARED` the instant its last guard dies. Phase 2 replaces that auto-success with
 * the parked-and-aimed timing puzzle, holding the camp at `DISARMABLE` until the player solves it.
 */
export type CampState = 'guarded' | 'disarmable' | 'cleared';

export interface Camp {
  level: number;
  state: CampState;
}

export const Camp = defineComponent<Camp>('Camp');
