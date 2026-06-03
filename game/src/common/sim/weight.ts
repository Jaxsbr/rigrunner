import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { Weight } from '@common/components/weight';

/**
 * The total mass the rig's engines must move: the chassis's own weight plus every weighted part
 * mounted on it. Engines are parts too, so their weight is counted here automatically — and any
 * future weighted part (a gun, a full container, cargo) is included the moment it's mounted, with
 * no change here.
 */
export function totalRigWeight(world: World, rig: EntityId): number {
  let total = world.get(rig, Weight)?.value ?? 0;
  for (const p of world.query(Part, Mount, Weight)) {
    if (world.get(p, Mount)!.rig === rig) total += world.get(p, Weight)!.value;
  }
  return total;
}
