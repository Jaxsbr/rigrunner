import type { World } from '@core/world';
import { Chassis } from '@common/components/chassis';
import { ownedChassis, getActiveRig, setActiveRig } from './ownership';

/**
 * The chassis bar (top-left): one chip per chassis the player owns, labelled with its size and its
 * 1..N hotkey, the active one highlighted. Click a chip — or press its number — to switch which
 * chassis the player controls; `main.ts` reads `getActiveRig` each frame, so input, camera, HUD and
 * the workshop/scrap gates all follow the selection.
 *
 * A pure projection, like `StatsHud`: it reads owned/active from the World and writes the `ActiveRig`
 * marker back on selection, owning no state of its own. It rebuilds its chips only when the owned set
 * or the active rig changes (a signature diff), so a second chip appears the instant a hauled-out kit
 * deploys and the highlight tracks 1/2 immediately.
 */
export class ChassisBar {
  private last = '';

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    // 1..N selects the Nth owned chassis (in stable ownership order). Other keys are ignored, so
    // this never clashes with WASD driving or the workshop's E/Escape.
    const n = Number(e.key);
    if (!Number.isInteger(n) || n < 1) return;
    const target = ownedChassis(this.world)[n - 1];
    if (target !== undefined) setActiveRig(this.world, target);
  };

  constructor(private readonly el: HTMLElement, private readonly world: World) {
    window.addEventListener('keydown', this.onKeyDown);
  }

  /** Re-render the bar when the owned set or the active rig changes (cheap no-op otherwise). */
  update(): void {
    const owned = ownedChassis(this.world);
    const active = getActiveRig(this.world);
    const sig = owned
      .map((e) => `${e}:${this.world.get(e, Chassis)?.size ?? '?'}${e === active ? '*' : ''}`)
      .join('|');
    if (sig === this.last) return;
    this.last = sig;

    this.el.innerHTML = '';
    owned.forEach((e, i) => {
      const size = (this.world.get(e, Chassis)?.size ?? '').replace('x', '×');
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chassis-chip' + (e === active ? ' active' : '');
      chip.innerHTML = `<span class="cc-key">${i + 1}</span><span class="cc-size">${size}</span>`;
      chip.addEventListener('click', () => setActiveRig(this.world, e));
      this.el.appendChild(chip);
    });
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
  }
}
