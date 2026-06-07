import { describe, it, expect } from 'vitest';
import { difficultyFor, gradeDisarm, disarmDamage, DISARM, DISARM_DIFFICULTY } from './disarm';

describe('disarm difficulty (tier → puzzle)', () => {
  it('rusty is the hard default (many narrow rounds); iron is the easy upgrade (one wide round)', () => {
    expect(DISARM_DIFFICULTY.rusty).toEqual({ rounds: 3, zoneWidth: 0.16 });
    expect(DISARM_DIFFICULTY.iron).toEqual({ rounds: 1, zoneWidth: 0.34 });
    // iron is strictly easier on both axes.
    expect(DISARM_DIFFICULTY.iron.rounds).toBeLessThan(DISARM_DIFFICULTY.rusty.rounds);
    expect(DISARM_DIFFICULTY.iron.zoneWidth).toBeGreaterThan(DISARM_DIFFICULTY.rusty.zoneWidth);
  });

  it('falls back to the hard rusty default for an unknown tier', () => {
    expect(difficultyFor('rusty')).toBe(DISARM_DIFFICULTY.rusty);
    expect(difficultyFor('iron')).toBe(DISARM_DIFFICULTY.iron);
    expect(difficultyFor('mythril' as never)).toBe(DISARM_DIFFICULTY.rusty);
  });
});

describe('gradeDisarm (play all N, tally hits)', () => {
  it('all landed → success, none → fail, between → partial (3-round rusty)', () => {
    expect(gradeDisarm(3, 3)).toBe('success');
    expect(gradeDisarm(2, 3)).toBe('partial');
    expect(gradeDisarm(1, 3)).toBe('partial');
    expect(gradeDisarm(0, 3)).toBe('fail');
  });

  it('is binary success/fail for a one-round (iron) puzzle', () => {
    expect(gradeDisarm(1, 1)).toBe('success');
    expect(gradeDisarm(0, 1)).toBe('fail');
  });
});

describe('disarmDamage (botched disarm springs the trap)', () => {
  it('success is clean (no damage, no rng drawn)', () => {
    let drawn = false;
    const rng = (): number => { drawn = true; return 0; };
    expect(disarmDamage('success', rng)).toBe(0);
    expect(drawn).toBe(false);
  });

  it('fail always deals the full damage (no rng drawn)', () => {
    let drawn = false;
    const rng = (): number => { drawn = true; return 0; };
    expect(disarmDamage('fail', rng)).toBe(DISARM.failDamage);
    expect(drawn).toBe(false);
  });

  it('partial deals damage only when the chance roll lands under the threshold', () => {
    expect(disarmDamage('partial', () => 0)).toBe(DISARM.partialDamage); // 0 < 0.5 → nicked
    expect(disarmDamage('partial', () => 0.49)).toBe(DISARM.partialDamage);
    expect(disarmDamage('partial', () => 0.5)).toBe(0); // not < 0.5 → clean
    expect(disarmDamage('partial', () => 0.99)).toBe(0);
  });
});
