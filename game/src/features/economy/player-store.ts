import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Wallet } from './wallet';
import { Inventory } from './inventory';

/**
 * Create the player store: the ONE singleton entity holding what the player OWNS across rebuilds —
 * `Wallet` (banked scrap) + `Inventory` (owned-unplaced parts/products). It lives outside any
 * rig/container so both survive rig rebuilds and chassis swaps. Every world entry path (the sandbox
 * seed, the new-game seed, the save restore) creates it through here, so the store's shape has a
 * single owner.
 */
export function createPlayerStore(world: World, scrap: number): EntityId {
  const store = world.createEntity();
  world.add(store, Wallet, { scrap });
  world.add(store, Inventory, { items: [] });
  return store;
}
