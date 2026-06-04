import type { World } from '@core/world';
import { ScrapPile } from './scrap-pile';

/**
 * The bottom-centre "Scrap Pile · Hold E" HUD prompt — the screen-space replacement for the old
 * floating world-space "Hold E" bubble. Like the workshop's tab it's a fixed cue that advertises the
 * rummage key without ever sitting over the heap from a bad camera angle.
 *
 * Purely informational: rummaging is the held E key (a continuous action), so the prompt only
 * reflects state — it isn't clicked (unlike the workshop tab, whose click is a one-shot open). It
 * shares the workshop tab's bottom-centre slot, which is safe because the two gates never coincide:
 * the workshop sits alone at +Z while piles are scattered far across the field.
 */
export class ScrapPrompt {
  constructor(private readonly el: HTMLElement) {}

  /** Show the prompt iff `live` (the sim is running) and some scrap pile's gate is currently lit. */
  sync(world: World, live: boolean): void {
    let active = false;
    if (live) {
      for (const e of world.query(ScrapPile)) {
        if (world.get(e, ScrapPile)!.active) {
          active = true;
          break;
        }
      }
    }
    this.el.classList.toggle('hidden', !active);
  }
}
