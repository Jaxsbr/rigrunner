import { defineComponent } from '@core/component';

/**
 * The handoff marker a cleared camp leaves behind — a richer sibling of scrap's `ClearedGround`. The
 * camp publishes "I'm cleared, here's a site" and knows nothing about what happens next; NOTHING
 * consumes this yet, deliberately. It is the exact seam the world-restoration work (M4) subscribes to
 * later (a sprout/soil site the world can heal). A new marker rather than bare `ClearedGround` because a
 * camp site is a deliberate, visible, investable feature, not just a "cleared earth" record.
 */
export interface RestorableSite {
  x: number;
  z: number;
  /** What kind of site this is (a `'camp'` today) — lets the future restoration pick a treatment. */
  kind: string;
  /** The level of the camp that produced it — richer restorations can scale off it. */
  sourceLevel: number;
}

export const RestorableSite = defineComponent<RestorableSite>('RestorableSite');
