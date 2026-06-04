import { defineComponent } from '@core/component';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';

/**
 * The player's generic inventory: the entities they OWN but haven't placed — loose engine sub-parts
 * today, assembled engines later. Each item is a world entity id (parts are first-class entities),
 * so a part's identity and per-part state survive being moved between inventory ↔ bench ↔ engine
 * (`observations.md` #6–7).
 *
 * Lives on the SAME singleton entity as `Wallet` — together "what the player owns": `Wallet` holds
 * scrap, `Inventory` holds parts. Like the wallet it sits outside any rig/container, so it survives
 * rig rebuilds and chassis swaps (readying the "multiple chassis" idea). Items here are unplaced by
 * definition — a part moved onto the bench or mounted leaves the inventory list.
 */
export interface Inventory {
  /** Owned-but-unplaced entity ids. Order is insertion order; no duplicates. */
  items: EntityId[];
}

export const Inventory = defineComponent<Inventory>('Inventory');

/**
 * The player's inventory, or null before it exists — the ONE way to reach the singleton, mirroring
 * `getWallet`. Returns the live component (a mutable reference), so the helpers below and any reader
 * operate on the same array.
 */
export function getInventory(world: World): Inventory | null {
  const e = world.query(Inventory)[0];
  return e !== undefined ? world.get(e, Inventory)! : null;
}

/**
 * Add an owned item to the inventory. Idempotent — adding an id already present is a no-op, so the
 * list never duplicates an entity (accounting stays conserved). No-op if no inventory exists yet.
 */
export function addToInventory(world: World, item: EntityId): void {
  const inv = getInventory(world);
  if (inv && !inv.items.includes(item)) inv.items.push(item);
}

/**
 * Remove an item from the inventory (e.g. when it's placed on the bench or mounted). Conserved: it
 * only drops the id from the owned list — it does NOT destroy the entity, since the part lives on
 * wherever it moved to. No-op if the item isn't held.
 */
export function removeFromInventory(world: World, item: EntityId): void {
  const inv = getInventory(world);
  if (!inv) return;
  const i = inv.items.indexOf(item);
  if (i !== -1) inv.items.splice(i, 1);
}

/** A snapshot copy of the owned item ids — safe to iterate while moving parts in/out. */
export function inventoryItems(world: World): EntityId[] {
  return getInventory(world)?.items.slice() ?? [];
}
