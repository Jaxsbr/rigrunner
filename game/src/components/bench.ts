import { defineComponent } from '../core/component';
import type { World } from '../core/world';
import type { EntityId } from '../core/types';

/**
 * The assembly bench: the role slots a player drops loose parts into while composing the ACTIVE
 * recipe's output inside the workshop. The bench holds whichever recipe is currently loaded
 * (`recipeId`) plus a slot map for exactly that recipe's roles — so switching from the engine
 * (four slots) to the storage container (two slots) reshapes the bench. Each slot holds at most one
 * part entity, or `null` when empty.
 *
 * In P3 the bench is pure working space: parts sit in their matching role slot but nothing is
 * assembled yet. The bench is a SINGLETON (one workshop, one bench) reached like `Inventory`/`Wallet`
 * via its component query; it lives on its own entity so its lifetime is independent of any rig.
 *
 * Slots are keyed by plain role strings (a part's catalog `slot`), so the component stays decoupled
 * from the recipe CONTENT — callers pass the active recipe's slot names. Conservation: a part is in
 * EXACTLY one place at a time — the inventory list OR a bench slot OR mounted. The helpers here only
 * move the bench side; callers pair them with the inventory helpers so nothing is duplicated or lost.
 */
export interface Bench {
  /** The recipe currently loaded on the bench (its id — resolve via `recipeById`). */
  recipeId: string;
  /** The part filling each of the active recipe's role slots, or `null` if empty. */
  slots: Record<string, EntityId | null>;
}

export const Bench = defineComponent<Bench>('Bench');

/** A fresh, all-empty slot map for the given role names — the shape a recipe loads onto the bench. */
export function emptyBenchSlots(slots: readonly string[]): Record<string, EntityId | null> {
  const map: Record<string, EntityId | null> = {};
  for (const slot of slots) map[slot] = null;
  return map;
}

/**
 * The bench singleton, or null before it exists — the ONE way to reach it, mirroring `getInventory`.
 * Returns the live component so helpers and readers operate on the same slots.
 */
export function getBench(world: World): Bench | null {
  const e = world.query(Bench)[0];
  return e !== undefined ? world.get(e, Bench)! : null;
}

/** A snapshot copy of the active slot → part map — safe to read while moving parts in/out. */
export function benchSlots(world: World): Record<string, EntityId | null> {
  const bench = getBench(world);
  return bench ? { ...bench.slots } : {};
}

/**
 * Place a part in its role slot. Succeeds only when the slot exists in the active recipe AND is
 * currently empty — the bench refuses to overwrite an occupied slot (you must clear it first), so a
 * place can never silently drop the part that was already there. Returns `true` if it took the slot,
 * `false` if it was refused. Does NOT touch the inventory — the caller removes the part on success.
 */
export function placeOnBench(world: World, slot: string, item: EntityId): boolean {
  const bench = getBench(world);
  if (!bench || bench.slots[slot] !== null || !(slot in bench.slots)) return false;
  bench.slots[slot] = item;
  return true;
}

/**
 * Empty a bench slot, returning the part that was in it (or `null` if it was already empty / not a
 * slot of the active recipe). Does NOT destroy the entity or touch the inventory — the caller adds
 * the returned part back to inventory, keeping the accounting conserved.
 */
export function clearBenchSlot(world: World, slot: string): EntityId | null {
  const bench = getBench(world);
  if (!bench) return null;
  const item = bench.slots[slot] ?? null;
  if (slot in bench.slots) bench.slots[slot] = null;
  return item;
}

/** The slot a part currently occupies, or `null` if it isn't on the bench. */
export function benchSlotOf(world: World, item: EntityId): string | null {
  const bench = getBench(world);
  if (!bench) return null;
  for (const slot of Object.keys(bench.slots)) {
    if (bench.slots[slot] === item) return slot;
  }
  return null;
}

/**
 * Load a (different) recipe onto the bench: set the active recipe id and reset the slot map to that
 * recipe's empty roles. Callers must first drain any parts currently on the bench back to inventory
 * (this discards the old slot map), so nothing is lost across the switch.
 */
export function loadRecipe(world: World, recipeId: string, slots: readonly string[]): void {
  const bench = getBench(world);
  if (!bench) return;
  bench.recipeId = recipeId;
  bench.slots = emptyBenchSlots(slots);
}
