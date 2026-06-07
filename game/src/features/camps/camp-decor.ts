import { defineComponent } from '@core/component';
import type { EntityId } from '@core/types';

/**
 * Back-links a world-decoration entity to the camp whose teardown it shares — so its render can read the
 * camp's `tornDown` progress without a spatial search. Two kinds carry it:
 *   - the TRANSIENT mess (tent, loot cache, scattered debris) — sinks + shrinks as the camp dissolves,
 *     then `campSystem` despawns it (the man-made junk is gone);
 *   - the LASTING stump (also a `RestorableSite`) — rises out of the soil on the same clock and is
 *     spared the despawn, persisting as the camp's scar.
 *
 * So `campSystem.despawnDecor` drops every `CampDecor` of the camp EXCEPT the one that is also a
 * `RestorableSite`. The guards are NOT decor — they carry `Enemy { camp }` and are cleared by combat.
 */
export interface CampDecor {
  camp: EntityId;
}

export const CampDecor = defineComponent<CampDecor>('CampDecor');
