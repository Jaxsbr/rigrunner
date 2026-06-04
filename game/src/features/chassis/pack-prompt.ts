/**
 * The bottom-centre "Pack up chassis · Press E" HUD prompt: the fixed screen-space cue that the
 * chassis you're driving is empty and can be folded back into a kit. Shares the workshop tab / scrap
 * prompt's `.hud-prompt` look and bottom-centre slot — safe because the composition root only lights
 * it when neither of those is showing (an empty chassis carries no Reclaimer so it can't rummage, and
 * pack-up defers to a workshop zone), so the slot holds exactly one prompt at a time.
 *
 * Purely informational, like the scrap prompt: packing is the single E press the frame loop handles,
 * so the prompt only mirrors the gate — it has no click handler of its own.
 */
export class PackPrompt {
  constructor(private readonly el: HTMLElement) {}

  /** Show the prompt iff the pack-up gate is currently lit (the composition root decides when). */
  sync(active: boolean): void {
    this.el.classList.toggle('hidden', !active);
  }
}
