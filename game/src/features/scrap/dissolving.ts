import { defineComponent } from '@core/component';

/**
 * The reclaim-dissolve clock a fully-rummaged scrap pile runs instead of vanishing instantly — scrap's
 * sibling of the camp's `Camp.tornDown`. It rides BOTH pieces of the handoff on the same `elapsed`:
 *   - the emptied PILE heap (also a `ScrapPile`) — sinks + shrinks into the ground, then is despawned;
 *   - the LASTING stump (also a `RestorableSite`) — rises out of the soil in its place, then holds.
 *
 * `pileClearSystem` advances `elapsed` and, at `DISSOLVE_DURATION`, destroys the heap (gone) and strips
 * `Dissolving` off the stump (risen — it holds at rest). The clear animator reads `elapsed` to pose both.
 * Sim-clocked, view-posed: the clock advances with the sim (frozen behind the loot popup); the animator
 * runs always, so a mid-dissolve pose holds behind an overlay rather than snapping.
 */
export interface Dissolving {
  /** Seconds into the dissolve; progress = `elapsed / DISSOLVE_DURATION`. */
  elapsed: number;
}

export const Dissolving = defineComponent<Dissolving>('Dissolving');

/** How long the reclaim dissolve takes — the heap sinks and the stump rises over this many seconds. Short
 *  (a quick, satisfying pop-to-life), since there's no long stain fade to co-time with as the camp has. */
export const DISSOLVE_DURATION = 2.5;
