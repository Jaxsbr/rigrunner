import type { World } from '../core/world';
import type { EntityId } from '../core/types';
import { Storage } from '../components/storage';
import { Wallet } from '../components/wallet';
import { WorkshopDrain } from '../components/workshop-drain';
import { mountedStorages } from './scrap-collection';

/**
 * Workshop drain: bank scrap out of containers parked on a workshop into the player's Wallet.
 *
 * A container on the workshop deck drains a piece at a time on a fixed interval, so the player
 * WATCHES the wallet tick up and the container's fill drop (the fill is driven by Storage.amount in
 * the render layer, so lowering amount lowers it for free) — progress is watched, not a number that
 * jumps. Gated purely by "a non-empty container is on the deck": once draining starts it doesn't
 * care whether the rig is still parked, and grabbing a container off the deck mid-drain simply stops
 * it (it's no longer found here) with whatever amount remained.
 *
 * ── Upgrade seams (captured ideas, not committed mechanics — see docs/ideas.md) ─────────────────
 *  • DRAIN_INTERVAL is the RATE axis: a future player upgrade would shrink it so the workshop banks
 *    scrap faster. Read it from an upgrade/component instead of this constant when that lands.
 *  • The single-container, one-at-a-time loop below is the CONCURRENCY axis: drain is SEQUENTIAL by
 *    design today (one container empties before the next starts). A future upgrade would let N
 *    containers drain at once — widen the "drain the first non-empty" step to drain the first N.
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Pure over the World: the only mutations are the transfer (amount−−, wallet++) and the per-workshop
 * timer, so it runs and tests headless.
 */
const DRAIN_INTERVAL = 0.4; // seconds per piece banked (RATE upgrade axis — see above)

export function workshopDrainSystem(world: World, dt: number): void {
  const wallet = firstWallet(world);
  if (wallet === null) return; // no bank to drain into

  const w = world.get(wallet, Wallet)!;

  for (const shop of world.query(WorkshopDrain)) {
    const drain = world.get(shop, WorkshopDrain)!;

    // SEQUENTIAL: the single container we're emptying right now is the first non-empty one in the
    // same front-to-back / left-to-right order scrap fills them. (Concurrency upgrade widens this.)
    let current = firstNonEmpty(world, shop);
    if (current === null) {
      drain.elapsed = 0; // nothing to drain → don't bank time for the next container's arrival
      continue;
    }

    drain.elapsed += dt;
    // Bank as many whole pieces as the accrued time covers (handles a long frame moving >1 piece),
    // advancing to the next container in order as each empties — still strictly one piece per tick.
    while (drain.elapsed >= DRAIN_INTERVAL && current !== null) {
      const s = world.get(current, Storage)!;
      s.amount -= 1;
      w.scrap += 1;
      drain.elapsed -= DRAIN_INTERVAL;
      if (s.amount <= 0) current = firstNonEmpty(world, shop);
    }
  }
}

/** The first container on this workshop with scrap left to give, in deposit order, or null. */
function firstNonEmpty(world: World, shop: EntityId): EntityId | null {
  for (const c of mountedStorages(world, shop)) {
    if (world.get(c, Storage)!.amount > 0) return c;
  }
  return null;
}

/** The singleton Wallet entity (the player's bank), or null if none exists yet. */
function firstWallet(world: World): EntityId | null {
  const all = world.query(Wallet);
  return all.length > 0 ? all[0]! : null;
}
