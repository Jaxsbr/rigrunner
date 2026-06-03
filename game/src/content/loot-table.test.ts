import { describe, it, expect } from 'vitest';
import { rollLoot, LOOT_TABLE, SUB_PART_POOL } from './loot-table';
import { partDef } from './parts-catalog';

/** A deterministic rng that yields the given values in order (then repeats the last). */
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
}

describe('LOOT_TABLE shape', () => {
  it('lists scrap as a burst tier and the others as empty-roll', () => {
    const byId = Object.fromEntries(LOOT_TABLE.tiers.map((t) => [t.id, t]));
    expect(byId['scrap']!.source).toBe('burst');
    expect(byId['sub-part']!.source).toBe('empty-roll');
    expect(byId['full-part']!.source).toBe('empty-roll');
    expect(byId['recipe']!.source).toBe('empty-roll');
  });

  it('carries full-part and recipe as dormant stubs (disabled, no pool)', () => {
    const byId = Object.fromEntries(LOOT_TABLE.tiers.map((t) => [t.id, t]));
    expect(byId['full-part']!.enabled).toBe(false);
    expect(byId['recipe']!.enabled).toBe(false);
    expect(byId['sub-part']!.enabled).toBe(true);
  });

  it('draws the common pool from engine + storage parts, not the premium Reclaimer parts', () => {
    expect(SUB_PART_POOL).toContain('e-core');
    expect(SUB_PART_POOL).toContain('container-shell');
    expect(SUB_PART_POOL).not.toContain('reclaimer-arm');
    // every id resolves to a real catalog part
    for (const id of SUB_PART_POOL) expect(partDef(id)).toBeDefined();
  });
});

describe('rollLoot', () => {
  it('yields nothing when the sub-part chance roll fails', () => {
    // first rng ≥ 0.25 → the (only enabled) sub-part tier doesn't drop; stubs are skipped.
    expect(rollLoot(seq([0.9]))).toEqual([]);
  });

  it('drops a deterministic count of sub-parts from the pool on success', () => {
    // 0.1 < 0.25 → drops; 0.5 → count = 1 + floor(0.5*3) = 2; then two pool picks (first + last).
    const lastIdx = SUB_PART_POOL.length - 1;
    const finds = rollLoot(seq([0.1, 0.5, 0, 0.999]));
    expect(finds).toHaveLength(2);
    expect(finds.every((f) => f.tierId === 'sub-part' && f.rarity === 'common')).toBe(true);
    expect(finds[0]!.itemId).toBe(SUB_PART_POOL[0]);
    expect(finds[1]!.itemId).toBe(SUB_PART_POOL[lastIdx]);
  });

  it('clamps the count to the tier range (min 1, max 3)', () => {
    // success, count rng = 0 → n = 1 (min); one pick.
    expect(rollLoot(seq([0, 0, 0]))).toHaveLength(1);
    // success, count rng → just under 1 → n = 3 (max); three picks.
    expect(rollLoot(seq([0, 0.999, 0, 0, 0]))).toHaveLength(3);
  });

  it('never yields the disabled stub tiers (full-part / recipe)', () => {
    // even with an all-success rng, only the sub-part tier can drop.
    const finds = rollLoot(() => 0);
    expect(finds.every((f) => f.tierId === 'sub-part')).toBe(true);
  });
});
