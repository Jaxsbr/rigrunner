import { describe, it, expect } from 'vitest';
import { rollCount, rollTable, type LootTier } from './loot';

/** A deterministic rng that replays a fixed sequence (looping), so a roll's path is exact. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

const TIER = (over: Partial<LootTier>): LootTier => ({
  id: 't', label: 'T', rarity: 'common', source: 'empty-roll', chance: 0.5,
  count: { min: 1, max: 1 }, pool: ['a', 'b'], enabled: true, ...over,
});

describe('rollCount', () => {
  it('returns the inclusive range bounds at the rng extremes', () => {
    expect(rollCount({ min: 2, max: 4 }, () => 0)).toBe(2);
    expect(rollCount({ min: 2, max: 4 }, () => 0.999)).toBe(4);
  });
});

describe('rollTable', () => {
  it('skips burst, disabled, and empty-pool tiers (only enabled empty-roll tiers drop)', () => {
    const tiers: LootTier[] = [
      TIER({ id: 'burst', source: 'burst' }),
      TIER({ id: 'off', enabled: false }),
      TIER({ id: 'empty', pool: [] }),
    ];
    expect(rollTable(tiers, () => 0)).toEqual([]);
  });

  it('drops a tier when its chance passes and draws the rolled count from the pool', () => {
    // rng: 0.0 → chance passes (0 < 0.5); 0.999 → count = max (3); then 3 pool picks at index 0.
    const tier = TIER({ chance: 0.5, count: { min: 1, max: 3 }, pool: ['x', 'y'] });
    const finds = rollTable([tier], seq([0.0, 0.999, 0, 0, 0]));
    expect(finds).toHaveLength(3);
    expect(finds.every((f) => f.itemId === 'x' && f.tierId === 't')).toBe(true);
  });

  it('does not drop a tier when its chance fails', () => {
    expect(rollTable([TIER({ chance: 0.5 })], () => 0.9)).toEqual([]);
  });
});
