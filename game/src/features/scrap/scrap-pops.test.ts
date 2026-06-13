import { describe, it, expect } from 'vitest';
import type { EntityId } from '@core/types';
import { shouldWarnNoSpace } from './scrap-pops';

/**
 * The "NO SPACE" firing decision (the rest of ScrapPops drives THREE sprites, so it's exercised in the
 * running game). The rule the warning must obey: remind the player as they drive over fresh scrap they
 * can't take, but DON'T nag while parked on one stuck piece — the bug that motivated this test.
 */
describe('shouldWarnNoSpace', () => {
  const A = 1 as EntityId;
  const B = 2 as EntityId;

  it('does not fire when nothing is refused', () => {
    expect(shouldWarnNoSpace([], new Set(), 0)).toBe(false);
  });

  it('fires for a newly-refused piece once the cooldown is clear', () => {
    expect(shouldWarnNoSpace([A], new Set(), 0)).toBe(true);
  });

  it('does NOT re-fire for a piece already being warned about — the parked-on-one-piece case', () => {
    // The rig sits on A frame after frame: A is already announced, so it must not nag again.
    expect(shouldWarnNoSpace([A], new Set([A]), 0)).toBe(false);
  });

  it('fires again when a DIFFERENT piece enters refusal (driving onto fresh scrap)', () => {
    expect(shouldWarnNoSpace([B], new Set([A]), 0)).toBe(true);
  });

  it('stays silent while the cooldown is still running, even for a new piece', () => {
    expect(shouldWarnNoSpace([B], new Set([A]), 0.5)).toBe(false);
  });
});
