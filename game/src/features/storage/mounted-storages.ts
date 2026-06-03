import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Storage } from '@common/components/storage';
import { Mount } from '@common/components/mount';

/**
 * A platform's mounted storage containers, ordered front-to-back (row) then left-to-right (col).
 * One definition of "which container is first" shared by the two features that walk a rig's
 * containers in deposit order: scrap COLLECTION fills them (`@features/scrap/scrap-collection`) and
 * the workshop DRAIN empties them in the SAME order (`@features/workshop/workshop-drain-system`).
 *
 * Lives in `features/storage/` (ADR-003 migration): extracting it out of `scrap-collection` removes
 * the `workshop → scrap` import edge the drain would otherwise carry, and a rig's container ordering
 * is storage's concern, not scrap's.
 */
export function mountedStorages(world: World, rig: EntityId): EntityId[] {
  const out: EntityId[] = [];
  for (const e of world.query(Storage, Mount)) {
    if (world.get(e, Mount)!.rig === rig) out.push(e);
  }
  out.sort((a, b) => {
    const ma = world.get(a, Mount)!;
    const mb = world.get(b, Mount)!;
    return ma.row - mb.row || ma.col - mb.col;
  });
  return out;
}
