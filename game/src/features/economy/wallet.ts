import { defineComponent } from '@core/component';
import type { World } from '@core/world';

/**
 * The player's scrap wallet: the running total of resource they OWN, banked out of containers.
 *
 * Deliberately NOT a property of the rig or any container — scrap owned must outlive any single
 * vehicle the player rebuilds and any container they swap. It lives on a dedicated singleton
 * entity (created in main.ts) so it's the stable anchor the whole build→run→spend loop turns on:
 * the workshop drain increments it (systems/workshop-drain.ts), the wallet HUD reads it
 * (ui/wallet-hud.ts), and the future spend-sink will draw it down from this one place.
 */
export interface Wallet {
  scrap: number;
}

export const Wallet = defineComponent<Wallet>('Wallet');

/**
 * The player's wallet, or null before it exists. The ONE way to reach the singleton — everyone who
 * banks into it or reads it goes through here, so "which entity is the wallet?" is answered in a
 * single place rather than each caller re-deriving `query(Wallet)[0]`. Returns the live component
 * (a mutable reference), so the drain mutates `.scrap` and the HUD reads it off the same object.
 *
 * `import type` keeps this a compile-time-only dependency on World — no runtime coupling of the
 * data definition to the store.
 */
export function getWallet(world: World): Wallet | null {
  const e = world.query(Wallet)[0];
  return e !== undefined ? world.get(e, Wallet)! : null;
}
