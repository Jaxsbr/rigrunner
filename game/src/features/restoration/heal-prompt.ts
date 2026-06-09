/**
 * The bottom-centre "Hold E" cue for the stump-heal interaction — the `ScrapPrompt`/`DisarmPrompt`
 * sibling. Shown only while a healable stump's gate is lit (the composition root decides when, off the
 * same gate the proximity disc lights on), so the ring and the prompt appear together. The prompt never
 * touches the World; main pushes the live gate state in each frame.
 */
export class HealPrompt {
  constructor(private readonly el: HTMLElement) {}

  /** Show the prompt iff the heal gate is currently open. */
  sync(active: boolean): void {
    this.el.classList.toggle('hidden', !active);
  }
}
