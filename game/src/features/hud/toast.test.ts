import { describe, it, expect } from 'vitest';
import { Toast, type ToastElement } from './toast';

/**
 * A stub standing in for the DOM element a toast drives — records the text and tracks whether the
 * `hidden` class is set, so the dismiss countdown can be tested headlessly (the suite runs in node,
 * no jsdom).
 */
function stubElement(): ToastElement & { hidden: boolean } {
  const state = {
    textContent: null as string | null,
    hidden: true,
    classList: {
      add(token: string): void {
        if (token === 'hidden') state.hidden = true;
      },
      remove(token: string): void {
        if (token === 'hidden') state.hidden = false;
      },
    },
  };
  return state;
}

describe('Toast', () => {
  it('shows a message and clears the hidden class', () => {
    const el = stubElement();
    new Toast(el).show('Field limit reached.');
    expect(el.textContent).toBe('Field limit reached.');
    expect(el.hidden).toBe(false);
  });

  it('self-dismisses after its duration elapses', () => {
    const el = stubElement();
    const toast = new Toast(el);
    toast.show('x');
    toast.update(1); // partway through — still up
    expect(el.hidden).toBe(false);
    toast.update(3); // past the 3.2s lifetime — gone
    expect(el.hidden).toBe(true);
  });

  it('keeps ticking down to exactly hide once, then no-ops', () => {
    const el = stubElement();
    const toast = new Toast(el);
    toast.show('x');
    toast.update(3.2); // exactly spent
    expect(el.hidden).toBe(true);
    // A re-show is needed to reappear; further ticks do nothing on their own.
    el.hidden = false; // pretend something else cleared it
    toast.update(1);
    expect(el.hidden).toBe(false); // update is inert once the countdown is spent
  });

  it('re-showing refreshes the countdown so a repeat event stays visible', () => {
    const el = stubElement();
    const toast = new Toast(el);
    toast.show('x');
    toast.update(3); // almost spent (0.2s left)
    toast.show('x'); // same event fires again — back to a full lifetime
    toast.update(1); // would have dismissed the first show; the refresh keeps it up
    expect(el.hidden).toBe(false);
  });
});
