import { defineComponent } from '../core/component';
import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import type { EnginePartSlot } from '../content/parts-catalog';

/**
 * The assembly bench: the four role slots a player drops loose parts into while composing an engine
 * inside the workshop. One slot per engine role (`casing`/`core`/`coupling`/`regulator`), each
 * holding at most one part entity — or `null` when empty.
 *
 * In P3 the bench is pure working space: parts sit in their matching role slot but nothing is
 * assembled yet. P4 reads these same four slots to decide if they form a complete, single-type
 * engine. The bench is a SINGLETON (one workshop, one bench) reached like `Inventory`/`Wallet` via
 * its component query; it lives on its own entity so its lifetime is independent of any rig.
 *
 * Conservation: a part is in EXACTLY one place at a time — the inventory list OR a bench slot OR
 * mounted. The helpers here only move the bench side; callers pair them with the inventory helpers
 * (`removeFromInventory`/`addToInventory`) so the part is never duplicated or lost across the move.
 */
export interface Bench {
  /** The part filling each role slot, or `null` if that slot is empty. */
  slots: Record<EnginePartSlot, EntityId | null>;
}

export const Bench = defineComponent<Bench>('Bench');

/** A fresh, all-empty set of bench slots — the shape every bench starts in. */
export function emptyBenchSlots(): Record<EnginePartSlot, EntityId | null> {
  return { casing: null, core: null, coupling: null, regulator: null };
}

/**
 * The bench singleton, or null before it exists — the ONE way to reach it, mirroring `getInventory`.
 * Returns the live component so helpers and readers operate on the same slots.
 */
export function getBench(world: World): Bench | null {
  const e = world.query(Bench)[0];
  return e !== undefined ? world.get(e, Bench)! : null;
}

/** A snapshot copy of the slot → part map — safe to read while moving parts in/out. */
export function benchSlots(world: World): Record<EnginePartSlot, EntityId | null> {
  const bench = getBench(world);
  return bench ? { ...bench.slots } : emptyBenchSlots();
}

/**
 * Place a part in its role slot. Succeeds only when the slot is currently empty — the bench refuses
 * to overwrite an occupied slot (you must clear it first), so a place can never silently drop the
 * part that was already there. Returns `true` if it took the slot, `false` if it was refused.
 * Does NOT touch the inventory — the caller removes the part from inventory on success.
 */
export function placeOnBench(world: World, slot: EnginePartSlot, item: EntityId): boolean {
  const bench = getBench(world);
  if (!bench || bench.slots[slot] !== null) return false;
  bench.slots[slot] = item;
  return true;
}

/**
 * Empty a bench slot, returning the part that was in it (or `null` if it was already empty). Does
 * NOT destroy the entity or touch the inventory — the caller adds the returned part back to
 * inventory, keeping the accounting conserved.
 */
export function clearBenchSlot(world: World, slot: EnginePartSlot): EntityId | null {
  const bench = getBench(world);
  if (!bench) return null;
  const item = bench.slots[slot];
  bench.slots[slot] = null;
  return item;
}

/** The slot a part currently occupies, or `null` if it isn't on the bench. */
export function benchSlotOf(world: World, item: EntityId): EnginePartSlot | null {
  const bench = getBench(world);
  if (!bench) return null;
  for (const slot of Object.keys(bench.slots) as EnginePartSlot[]) {
    if (bench.slots[slot] === item) return slot;
  }
  return null;
}
