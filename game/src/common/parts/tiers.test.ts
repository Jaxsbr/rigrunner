import { describe, it, expect } from 'vitest';
import { TIERS, tierOf, DEFAULT_TIER } from './tiers';

describe('material tiers', () => {
  it('starts with two tiers, rusty then iron, on a clear (eased) upward ladder', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['rusty', 'iron']);
    // Tier-1 is an identity (a rusty part resolves to exactly its base); each step up is a clear gain
    // (a meaningful upgrade) but deliberately gentle — iron is ~1.6× a rusty part, narrow enough that
    // the rusty floor stays playable (`docs/part-identity-spec.md` §2c).
    expect(TIERS[0]!.mult).toBe(1);
    expect(TIERS[1]!.mult).toBeGreaterThan(1.5); // a clear step up
    expect(TIERS[1]!.mult).toBeLessThan(2); // but gentle — keeps the rusty floor competitive
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i]!.mult).toBeGreaterThan(TIERS[i - 1]!.mult);
    }
  });

  it('defaults to the base of the ladder', () => {
    expect(DEFAULT_TIER).toBe(TIERS[0]!.id);
  });

  it('gives every tier a one-word prefix name and a finish colour, all distinct', () => {
    for (const t of TIERS) {
      expect(t.name.trim()).not.toBe('');
      expect(t.name.includes(' ')).toBe(false); // a single prefix word ("Iron Shell", not "Cast Iron Shell")
      expect(Number.isInteger(t.finishColor)).toBe(true);
    }
    expect(new Set(TIERS.map((t) => t.finishColor)).size).toBe(TIERS.length);
  });

  it('resolves a known tier and falls back to the base tier for an unknown id', () => {
    expect(tierOf('iron').mult).toBe(TIERS[1]!.mult);
    // @ts-expect-error — an out-of-range id is coerced to the safe base rather than returning undefined
    expect(tierOf('mithril')).toBe(TIERS[0]!);
  });
});
