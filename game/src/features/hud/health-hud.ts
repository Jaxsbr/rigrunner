import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Health } from '@common/components/health';

/**
 * The rig health bar (bottom-left). A pure projection of the active rig's `Health`, like the wallet HUD
 * is of the Wallet: each frame it reads `current`/`max` and sizes a fill bar, owning no truth. A
 * graphical bar (not a stats line) so it's glanceable mid-combat — you can't read a number while
 * dodging fire. The fill shrinks with HP and shifts green→red so "I'm in trouble" reads by colour alone.
 *
 * Only touches the DOM when the value changes, so it costs nothing per frame while idle.
 */
export class HealthHud {
  private last = -1;

  private readonly fill: HTMLElement;
  private readonly label: HTMLElement;

  constructor(private readonly el: HTMLElement) {
    this.fill = el.querySelector<HTMLElement>('#health-fill')!;
    this.label = el.querySelector<HTMLElement>('#health-label')!;
  }

  update(world: World, rig: EntityId): void {
    const h = world.get(rig, Health);
    if (!h) {
      this.el.classList.add('hidden');
      return;
    }
    this.el.classList.remove('hidden');
    const current = Math.max(0, Math.round(h.current));
    if (current === this.last) return;
    this.last = current;

    const pct = h.max > 0 ? Math.max(0, Math.min(1, h.current / h.max)) : 0;
    this.fill.style.width = `${pct * 100}%`;
    this.fill.style.background = `hsl(${pct * 120}, 70%, 45%)`; // 0 = red, 120 = green
    this.label.textContent = `${current} / ${h.max}`;
  }
}
