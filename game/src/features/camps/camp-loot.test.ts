import { describe, it, expect } from 'vitest';
import { partDef, SUB_PART_POOL } from '@common/parts/parts-catalog';
import { rollCampLoot, rollCampLootForOutcome, campLootTable, CAMP_LOOT } from './camp-loot';

describe('camp loot', () => {
  it('level-1 banks 15..30 wallet scrap and grants 2..4 real sub-parts', () => {
    const table = campLootTable('level-1');

    const low = rollCampLoot(table, () => 0);
    expect(low.walletScrap).toBe(15);
    expect(low.finds).toHaveLength(2);

    const high = rollCampLoot(table, () => 0.999);
    expect(high.walletScrap).toBe(30);
    expect(high.finds).toHaveLength(4);

    // Every find is a real catalog sub-part (the shared SUB_PART_POOL — engine/storage blocks).
    for (const find of high.finds) {
      expect(SUB_PART_POOL).toContain(find.itemId);
      expect(partDef(find.itemId)).toBeDefined();
    }
  });

  it('carries the full-part / recipe tiers as disabled stubs (never dropping yet)', () => {
    const tiers = CAMP_LOOT['level-1']!.tiers;
    expect(tiers.find((t) => t.id === 'full-part')!.enabled).toBe(false);
    expect(tiers.find((t) => t.id === 'recipe')!.enabled).toBe(false);
  });

  it('falls back to level-1 for an unknown loot id', () => {
    expect(campLootTable('nope')).toBe(CAMP_LOOT['level-1']);
  });
});

describe('rollCampLootForOutcome (disarm-gated payout)', () => {
  const table = campLootTable('level-1');

  it('success rolls the FULL payout — identical to rollCampLoot', () => {
    expect(rollCampLootForOutcome(table, 'success', () => 0)).toEqual(rollCampLoot(table, () => 0));
    const high = rollCampLootForOutcome(table, 'success', () => 0.999)!;
    expect(high.walletScrap).toBe(30); // full range max
    expect(high.finds).toHaveLength(4);
  });

  it('partial halves the wallet scrap and keeps only common-rarity tiers', () => {
    const low = rollCampLootForOutcome(table, 'partial', () => 0)!;
    expect(low.walletScrap).toBe(8); // round(15/2)
    const high = rollCampLootForOutcome(table, 'partial', () => 0.999)!;
    expect(high.walletScrap).toBe(15); // round(30/2)
    // Only common finds survive — the (disabled, rarer) stub tiers never appear regardless.
    for (const find of high.finds) expect(find.rarity).toBe('common');
  });

  it('fail yields nothing at all (no LootDrop is queued for a botched disarm)', () => {
    expect(rollCampLootForOutcome(table, 'fail', () => 0)).toBeNull();
  });
});
