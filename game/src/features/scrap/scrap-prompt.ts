import type { World } from '@core/world';
import { ScrapPile } from './scrap-pile';

/**
 * The bottom-centre "Scrap Pile · Hold E" HUD prompt: a fixed screen-space cue that advertises the
 * rummage key, so it never sits over the heap from a bad camera angle. Shares the workshop tab's look
 * (the `.hud-prompt` class) and its bottom-centre slot — safe because the two gates never coincide
 * (the workshop sits alone at +Z while piles are scattered far across the field).
 *
 * Purely informational: rummaging is the held E key (a continuous action), so the prompt only
 * reflects pile state — it has no click handler of its own.
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
