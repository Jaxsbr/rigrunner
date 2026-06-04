import { defineComponent } from '@core/component';
import type { World } from '@core/world';
import type { EntityId } from '@core/types';

/**
 * Chassis ownership + control — the data behind multi-chassis play. Both are markers ON the chassis
 * entities themselves, so the per-frame systems just query the World (nothing threads a "current
 * rig" mutable through the composition root):
 *
 *   - `PlayerChassis` — the player owns this chassis (the starter rig, plus any kit deployed out in
 *     the world). Capped at `MAX_OWNED`.
 *   - `ActiveRig` — the one chassis the player is currently controlling. Exactly one carries it;
 *     input, camera, HUD, the workshop zone, the scrap-pile gate and the build interaction all
 *     follow whichever chassis has it.
 *
 * They live in the chassis feature (not `common`) because ownership/selection is a chassis mechanic;
 * `main.ts` reads `getActiveRig` each frame and the chassis bar mutates the markers on input.
 */

/** Marks a chassis the player owns. */
export const PlayerChassis = defineComponent<true>('PlayerChassis');
/** Marks the chassis the player currently controls — exactly one at a time. */
export const ActiveRig = defineComponent<true>('ActiveRig');

/** The most chassis the player may own — the bar shows them and keys 1..MAX_OWNED select them. */
export const MAX_OWNED = 2;

/** Every chassis the player owns, oldest first (the stable selection / icon order). */
export function ownedChassis(world: World): EntityId[] {
  return world.query(PlayerChassis);
}

/** How many chassis the player owns. */
export function ownedCount(world: World): number {
  return world.query(PlayerChassis).length;
}

/** Register a chassis as owned by the player (idempotent). */
export function markOwned(world: World, chassis: EntityId): void {
  world.add(chassis, PlayerChassis, true);
}

/** The chassis the player is currently controlling, or null before one is set. */
export function getActiveRig(world: World): EntityId | null {
  return world.query(ActiveRig)[0] ?? null;
}

/**
 * Make `chassis` the active (controlled) rig — moves the single `ActiveRig` marker onto it. A no-op
 * for a chassis the player doesn't own (you can only control what you own) or one that's already
 * active. Returns whether the active rig actually changed.
 */
export function setActiveRig(world: World, chassis: EntityId): boolean {
  if (!world.has(chassis, PlayerChassis)) return false;
  const current = getActiveRig(world);
  if (current === chassis) return false;
  if (current !== null) world.remove(current, ActiveRig);
  world.add(chassis, ActiveRig, true);
  return true;
}
