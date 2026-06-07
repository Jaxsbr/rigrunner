/**
 * The bottom-centre "Disarm Trap · Press E" HUD prompt: the fixed screen-space cue that the rig is
 * parked in reach of a DISARMABLE camp with a trap arm mounted, so E will open the disarm puzzle.
 * Shares the workshop tab / scrap / pack prompts' `.hud-prompt` look and bottom-centre slot — safe
 * because the disarm gate only opens out at a cleared camp, far from any workshop zone or scrap pile,
 * so the slot holds exactly one prompt at a time.
 *
 * Purely informational, like the scrap + pack prompts: E is handled by the disarm overlay's own key
 * listener, so the prompt only mirrors the gate — it has no click handler of its own. The composition
 * root passes the live gate (the same one the proximity disc lights on, so the two appear in lockstep).
 */
export class DisarmPrompt {
  constructor(private readonly el: HTMLElement) {}

  /** Show the prompt iff the disarm gate is currently open (the composition root decides when). */
  sync(active: boolean): void {
    this.el.classList.toggle('hidden', !active);
  }
}
