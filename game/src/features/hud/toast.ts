/**
 * A transient on-screen notification — a "toast". It announces a one-off event (e.g. a chassis deploy
 * refused at the field cap), then fades on its own after a short beat.
 *
 * It fills the gap between the two HUD shapes the game already had: the fixed `.hud-prompt` cues mirror
 * a live gate and stay up as long as it holds, and the modal overlays freeze the game outright. A toast
 * does neither — it speaks once and leaves. The point is that a silent refusal reads as a bug; a toast
 * gives the moment a voice without stealing control.
 *
 * Generic by construction: it owns only its dismiss countdown and carries no chassis/cap semantics —
 * the caller supplies the text. `show` puts a message up and (re)starts the countdown, so a repeated
 * event refreshes the toast rather than flickering; `update` ticks that countdown each frame and hides
 * it when the time is spent. `.hidden` (a CSS opacity/transform transition) fades it off so it never
 * pops.
 */

/** Seconds a message stays up before it self-dismisses — long enough to read a short line, not nagging. */
const TOAST_DURATION = 3.2;

/**
 * The slim DOM surface a toast drives. `HTMLElement` satisfies it structurally, so `main.ts` passes a
 * real element while a headless test passes a stub — the dismiss logic is exercised without a DOM.
 */
export interface ToastElement {
  textContent: string | null;
  classList: { add(token: string): void; remove(token: string): void };
}

export class Toast {
  private remaining = 0;

  constructor(private readonly el: ToastElement) {}

  /** Put `message` up (or refresh the current one), restarting the dismiss countdown. */
  show(message: string): void {
    this.el.textContent = message;
    this.el.classList.remove('hidden');
    this.remaining = TOAST_DURATION;
  }

  /** Tick the dismiss countdown; hide the toast once it runs out. A no-op while already hidden. */
  update(dt: number): void {
    if (this.remaining <= 0) return;
    this.remaining -= dt;
    if (this.remaining <= 0) this.el.classList.add('hidden');
  }
}
