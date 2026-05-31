import type { World } from '../core/world';
import { Wallet } from '../components/wallet';

/**
 * The scrap wallet readout (top-right). A pure projection of the player's Wallet, like the stats
 * HUD is of the rig: it reads the banked total each frame and writes one line, owning no truth.
 * Kept as its own element (not a line in the rig stats) so the two stay independent — rig stats
 * project the VEHICLE, the wallet projects the PLAYER's resource. Temporary UI: when the real
 * economy screen lands, this one element is deleted without touching the stats HUD.
 *
 * Only rewrites the DOM when the number changes, so it costs nothing per frame while idle.
 */
export class WalletHud {
  private last = -1;

  constructor(private readonly el: HTMLElement) {}

  update(world: World): void {
    const wallet = world.query(Wallet)[0];
    const scrap = wallet !== undefined ? world.get(wallet, Wallet)!.scrap : 0;
    if (scrap !== this.last) {
      this.el.textContent = `SCRAP  ${scrap}`;
      this.last = scrap;
    }
  }
}
