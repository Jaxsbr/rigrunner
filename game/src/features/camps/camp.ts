import { defineComponent } from '@core/component';

/**
 * The camp objective's lifecycle. `GUARDED` while any guard lives (trap armed, stains present) →
 * `DISARMABLE` once all guards are cleared → `CLEARED` once disarmed. Reaching `CLEARED` grants loot
 * (gated on BOTH all-enemies-cleared AND a non-fail disarm), begins the stains fading, tears the
 * structures + debris down into the ground, and rises a restorable sprout in their place. Disarm is
 * the player's act: parking a rig with a mounted trap arm in range and solving the timing puzzle
 * (`disarm-overlay.ts`) — a camp with no trap arm simply stays `DISARMABLE`.
 */
export type CampState = 'guarded' | 'disarmable' | 'cleared';

export interface Camp {
  level: number;
  state: CampState;
  /**
   * Teardown progress once `CLEARED`, 0 → 1 over `TEARDOWN_DURATION`. The sim advances it
   * (`campSystem`); the view reads it to sink+shrink the camp's structures/debris and rise the sprout.
   * The structure/debris entities are despawned when it reaches 1. 0 while the camp still stands.
   */
  tornDown: number;
}

export const Camp = defineComponent<Camp>('Camp');
