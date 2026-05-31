import { defineComponent } from '../core/component';

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
