import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Mount } from '@common/components/mount';
import { MountGrid } from '@common/components/mount-grid';
import { Storage } from '@common/components/storage';
import { Transform } from '@common/components/transform';
import { Collectible } from '@features/scrap/collectible';
import type { CollisionPair } from '@common/sim/collision';
import { mountedStorages } from '@features/storage/mounted-storages';

/**
 * Scrap collection: turn collision contacts into cargo. Given this frame's collider pairs, a
 * Collectible (loose scrap) that touches a rig — its chassis OR any part mounted on it — is
 * collected into that rig's storage and removed from the world.
 *
 * Deposit rule (agreed): scan the rig's mounted Storage by cell, front-to-back then left-to-right
 * (row, then col), and drop the whole piece into the FIRST container with room for ALL of it. A piece
 * is atomic — it lands whole or not at all: it never splits across containers, and it never partially
 * fills then wastes the rest. If no container has room for the whole piece (or none is mounted) the
 * scrap is NOT collected: it stays in the world and the rig gets a NO SPACE cue (the build→run gate —
 * "bank now, or bolt on more storage"). Each piece is collected at most once per frame even if it
 * touches several of the rig's colliders at once.
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


/** A piece that landed in storage this frame — its world spot + value, for the "+N" pickup pop. */
export interface CollectedPiece {
  x: number;
  z: number;
  value: number;
}

/**
 * A piece a full / storage-less rig drove over but couldn't take — its entity id + world spot, for the
 * "no space" warning. The id lets the warning tell one stuck piece from the next, so a rig parked on a
 * single uncollectable piece warns once rather than nagging every frame.
 */
export interface RefusedPiece {
  id: EntityId;
  x: number;
  z: number;
}

/**
 * What collection produced this frame: the pieces swept into storage and the pieces a full (or
 * storage-less) rig drove over but had to leave. The composition root turns these into floating
 * feedback (a "+N" pop per collected piece, a debounced "NO SPACE" when any was refused); tests
 * assert them directly. The system owns no view state — this is just the report of what it did.
 */
export interface CollectionResult {
  collected: CollectedPiece[];
  refused: RefusedPiece[];
}

/** The world spot of a scrap entity (loose scrap always carries a Transform; default to origin if not). */
function spotOf(world: World, scrap: EntityId): { x: number; z: number } {
  const t = world.get(scrap, Transform);
  return { x: t?.x ?? 0, z: t?.z ?? 0 };
}

/**
 * Try to drop the WHOLE `value` into the first container with room for all of it. Returns true if it
 * landed (the piece is collected), false if no container can take the whole piece / there are none —
 * the piece is left in the world (NO SPACE), never partially deposited.
 */
function depositIntoRig(world: World, rig: EntityId, value: number): boolean {
  for (const c of mountedStorages(world, rig)) {
    const s = world.get(c, Storage)!;
    if (s.amount + value <= s.capacity) { // the whole piece must fit — no split, no overfill
      s.amount += value;
      return true;
    }
  }
  return false;
}

/**
 * What a Collectible is worth when swept up: a fixed `value`, or — for a rolled collectible (loose
 * scrap) — a fresh uniform roll in `[valueMin, valueMax]` decided HERE, at the moment of collection.
 */
function collectibleValue(c: Collectible, rng: () => number): number {
  if (c.valueMin !== undefined && c.valueMax !== undefined) {
    return c.valueMin + Math.floor(rng() * (c.valueMax - c.valueMin + 1));
  }
  return c.value;
}

/**
 * Consume this frame's collision pairs, collecting any scrap that touched a rig. Returns what
 * happened (see `CollectionResult`): each piece swept into storage with its world spot + value, and
 * each piece a full / storage-less rig drove over but had to leave. A piece's spot is read BEFORE it
 * is destroyed, so a "+N" pop can be placed exactly where it was picked up. `rng` rolls a rolled
 * collectible's worth (loose scrap's 2–6) at collection; it defaults to `Math.random` and is injected
 * in tests for a deterministic value.
 */
export function scrapCollectionSystem(
  world: World,
  pairs: CollisionPair[],
  rng: () => number = Math.random,
): CollectionResult {
  const taken = new Set<EntityId>();
  const refusedIds = new Set<EntityId>();
  const collected: CollectedPiece[] = [];

  for (const { a, b } of pairs) {
    // One side must be a Collectible and the other a rig/mounted-part collector.
    const aIsScrap = world.has(a, Collectible);
    const bIsScrap = world.has(b, Collectible);
    if (aIsScrap === bIsScrap) continue; // both scrap, or neither — no collection here

    const scrap = aIsScrap ? a : b;
    const collector = aIsScrap ? b : a;
    if (taken.has(scrap)) continue; // already taken this frame via another contact

    const rig = rigOf(world, collector);
    if (rig === null) continue; // collector is a loose part / scenery — not a collector

    const value = collectibleValue(world.get(scrap, Collectible)!, rng);
    if (depositIntoRig(world, rig, value)) {
      taken.add(scrap);
      refusedIds.delete(scrap); // a later container had room after an earlier full one refused it
      const { x, z } = spotOf(world, scrap);
      collected.push({ x, z, value });
      world.destroyEntity(scrap);
    } else {
      refusedIds.add(scrap); // every container full / none mounted → left in the world for later
    }
  }

  // A piece refused by one contact may have been collected by another this frame — report only the
  // ones that ended up left behind, each once, at its world spot.
  const refused: RefusedPiece[] = [];
  for (const id of refusedIds) {
    if (!taken.has(id)) refused.push({ id, ...spotOf(world, id) });
  }

  return { collected, refused };
}
