import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { productSubPartTiers } from '@common/sim/assembly';
import { DEFAULT_TIER, type TierId } from '@common/parts/tiers';
import { Camp } from './camp';
import { DISARM } from './disarm';

/** A camp the rig can disarm right now, plus the head tier that sets the puzzle's difficulty. */
export interface DisarmTarget {
  camp: EntityId;
  headTier: TierId;
}

/**
 * The disarm gate (`@features/camps` Phase 2): is the active rig in a position to disarm a camp this
 * frame? It opens only when BOTH hold — the rig carries a MOUNTED trap arm, and a `DISARMABLE` camp sits
 * within `DISARM.range` of the rig. Returns the camp + the trap arm's HEAD tier (which sets the puzzle
 * difficulty), or null when either half is missing.
 *
 * Proximity is the only spatial gate (no facing/FOV requirement) — the disarm is a post-combat, safe
 * activity, so lining the arm up at the camp would be ceremony; being mounted is what the trap arm is
 * for. Main pushes this into the disarm overlay each frame (the overlay never queries the World itself).
 */
export function findDisarmTarget(world: World, rig: EntityId): DisarmTarget | null {
  const headTier = mountedTrapArmHeadTier(world, rig);
  if (headTier === null) return null;

  const rigT = world.get(rig, Transform);
  if (!rigT) return null;

  for (const c of world.query(Camp, Transform)) {
    if (world.get(c, Camp)!.state !== 'disarmable') continue;
    const ct = world.get(c, Transform)!;
    if (Math.hypot(ct.x - rigT.x, ct.z - rigT.z) <= DISARM.range) {
      return { camp: c, headTier };
    }
  }
  return null;
}

/**
 * The HEAD tier of a trap arm mounted on this rig, or null if the rig carries none. The disarm head is
 * the lockpick business end, so ITS grade — not the boom's — is what sets the puzzle difficulty (read
 * off the composed product's sub-part tiers). A trap arm somehow missing its head sub-part falls back to
 * the base tier (the hardest puzzle), never undefined.
 */
function mountedTrapArmHeadTier(world: World, rig: EntityId): TierId | null {
  for (const w of world.query(Part, Mount)) {
    if (world.get(w, Part)!.kind !== 'trap-arm') continue;
    if (world.get(w, Mount)!.rig !== rig) continue;
    return productSubPartTiers(world, w)['disarm-head'] ?? DEFAULT_TIER;
  }
  return null;
}
