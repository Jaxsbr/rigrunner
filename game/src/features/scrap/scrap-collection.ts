import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Mount } from '@common/components/mount';
import { MountGrid } from '@common/components/mount-grid';
import { Storage } from '@common/components/storage';
import { Collectible } from '@features/scrap/collectible';
import type { CollisionPair } from '@common/sim/collision';
import { mountedStorages } from '@features/storage/mounted-storages';

/**
 * Scrap collection: turn collision contacts into cargo. Given this frame's collider pairs, a
 * Collectible (loose scrap) that touches a rig — its chassis OR any part mounted on it — is
 * collected into that rig's storage and removed from the world.
 *
 * Deposit rule (agreed): scan the rig's mounted Storage by cell, front-to-back then left-to-right
 * (row, then col), and drop the whole piece into the FIRST container with room. A piece is atomic —
 * it never splits across containers. If every container is full, or none is mounted, the scrap is
 * NOT collected: it stays in the world (the build→run gate — "bolt on more storage"). Each piece is
 * collected at most once per frame even if it touches several of the rig's colliders at once.
 *
 * Pure over the World apart from the two mutations collection IS: incrementing a container's amount
 * and destroying the consumed scrap. It reads the pair list produced by collisionSystem and assigns
 * it meaning; the collider geometry itself lives in that system, not here.
 */

/** Resolve the rig an entity collects FOR: the rig itself (has a deck), or the rig a part is mounted on. */
function rigOf(world: World, e: EntityId): EntityId | null {
  if (world.has(e, MountGrid)) return e; // the rig's own chassis
  const m = world.get(e, Mount);
  if (m && world.isAlive(m.rig)) return m.rig; // a part mounted on a rig
  return null;
}


/**
 * Try to add `value` to the first non-full container on the rig. Returns true if it landed
 * somewhere (the piece is collected), false if every container is full / there are none.
 */
function depositIntoRig(world: World, rig: EntityId, value: number): boolean {
  for (const c of mountedStorages(world, rig)) {
    const s = world.get(c, Storage)!;
    if (s.amount < s.capacity) {
      s.amount = Math.min(s.capacity, s.amount + value); // atomic, clamped — never overfills
      return true;
    }
  }
  return false;
}

/**
 * Consume this frame's collision pairs, collecting any scrap that touched a rig. Returns the
 * collectibles actually collected (handy for tests and, later, feedback FX).
 */
export function scrapCollectionSystem(world: World, pairs: CollisionPair[]): EntityId[] {
  const collected = new Set<EntityId>();

  for (const { a, b } of pairs) {
    // One side must be a Collectible and the other a rig/mounted-part collector.
    const aIsScrap = world.has(a, Collectible);
    const bIsScrap = world.has(b, Collectible);
    if (aIsScrap === bIsScrap) continue; // both scrap, or neither — no collection here

    const scrap = aIsScrap ? a : b;
    const collector = aIsScrap ? b : a;
    if (collected.has(scrap)) continue; // already taken this frame via another contact

    const rig = rigOf(world, collector);
    if (rig === null) continue; // collector is a loose part / scenery — not a collector

    const value = world.get(scrap, Collectible)!.value;
    if (depositIntoRig(world, rig, value)) {
      collected.add(scrap);
      world.destroyEntity(scrap);
    }
    // else: every container full / none mounted → leave the scrap in the world untouched
  }

  return [...collected];
}
