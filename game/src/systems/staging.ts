import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Transform } from '../components/transform';
import { Part } from '../components/part';
import { Mount } from '../components/mount';
import { MountGrid } from '../components/mount-grid';
import { Assembly } from '../components/assembly';
import { WorkshopZone } from '../components/workshop-zone';
import { partAtCell, mountPart, unmountPart } from './mounting';
import { placeProductInWorld, removeFromWorld } from './assembly';
import { addToInventory } from '../components/inventory';

/**
 * Staging — moving a composed product between the player's abstract inventory and the workshop's
 * own mount grid (its "deck"), the bridge the workshop interface exposes in 3D. Staging is NOT a new
 * mechanism: a staged product is simply a product mounted on the WORKSHOP'S grid instead of the
 * rig's, so it reuses the exact same `mountPart`/`unmountPart` + world-presence seams the in-world
 * build interaction already uses. The only thing this module adds is the inventory↔deck hop the
 * abstract inventory can't do on its own (an inventory item has no Transform to carry onto a cell).
 *
 * Because a staged product is just "mounted on the workshop", a product the player sets on the deck
 * IN-WORLD (lifting it off the rig while parked) is staged too — the interface sees it through the
 * same query. Conservation holds end to end: a product is in exactly one place — inventory OR a
 * workshop cell OR mounted on the rig OR loose in the world.
 *
 * Everything here is pure over the World, so it runs and tests headless.
 */

/**
 * The workshop entity — the one carrying both a MountGrid (a deck) and a WorkshopZone (the proximity
 * gate that marks it as the workshop, not a rig, which also has a MountGrid). Returns null before a
 * workshop is spawned. MW has a single workshop; the first found answers (multiple workshops later).
 */
export function workshopEntity(world: World): EntityId | null {
  return world.query(MountGrid, WorkshopZone)[0] ?? null;
}

/** Every product currently staged on the workshop deck (parts whose Mount points at the workshop). */
export function stagedProducts(world: World, workshop: EntityId): EntityId[] {
  return world.query(Part, Mount).filter((p) => world.get(p, Mount)!.rig === workshop);
}

/**
 * Stage a product from inventory onto a workshop deck cell. It gains world presence (Transform/
 * Renderable/Collider — and MountFacing for an engine, via `placeProductInWorld`) and leaves the
 * inventory, then mounts on the cell. The sim is frozen while the interface is open, so the mounting
 * system won't ride it to the cell until the overlay closes — the 3D deck view draws it at its cell
 * pose directly from the Mount, so it shows correctly meanwhile. Only composed products may be
 * staged (a loose sub-part has no standalone use on a deck); a non-product is refused (returns false).
 */
export function stageProduct(
  world: World,
  product: EntityId,
  workshop: EntityId,
  col: number,
  row: number,
): boolean {
  if (!world.get(product, Assembly)) return false; // products only — sub-parts are barred
  if (partAtCell(world, workshop, col, row)) return false; // cell occupied — refused
  const wt = world.get(workshop, Transform);
  if (!wt) return false;
  // Position is irrelevant (the mount overrides it) — drop it at the workshop origin for presence.
  placeProductInWorld(world, product, wt.x, wt.z);
  mountPart(world, product, workshop, col, row);
  return true;
}

/**
 * Pull a staged product off the workshop deck and back into inventory — the inverse of
 * `stageProduct`. Unmounts it, strips the world presence it gained, and returns it to inventory.
 * Conserved: the same product entity moves, nothing is cloned or destroyed.
 */
export function unstageProduct(world: World, product: EntityId): void {
  unmountPart(world, product);
  removeFromWorld(world, product);
  addToInventory(world, product);
}
