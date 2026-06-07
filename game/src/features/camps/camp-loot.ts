import { SUB_PART_POOL } from '@common/parts/parts-catalog';
import { rollCount, rollTable, type LootTier, type LootFind } from '@common/sim/loot';
import type { DisarmGrade } from './disarm';

/**
 * The camp loot tables — richer than a scrap pile's, rolled through the SHARED loot roller
 * (`@common/sim/loot`), the seam Option C's loot table was built for. A cleared camp pays out two ways:
 *   - `walletScrap` — a guaranteed scrap chunk granted STRAIGHT to the Wallet (a camp isn't a heap, so
 *     there's no scatter-and-sweep), rolled as a range.
 *   - `tiers` — the non-scrap finds (sub-parts), rolled through `rollTable` and granted to the Inventory
 *     via the loot overlay, exactly like a pile's finds.
 *
 * In Phase 1 disarm auto-succeeds, so all eligible tiers drop. The full-part / recipe tiers stay the
 * same committed STUBS the pile table carries (disabled, empty pool) until their systems land; Phase 2's
 * partial-disarm outcome will gate which tiers are eligible.
 */
export interface CampLootTable {
  walletScrap: { min: number; max: number };
  tiers: readonly LootTier[];
}

export const CAMP_LOOT: Record<string, CampLootTable> = {
  'level-1': {
    walletScrap: { min: 15, max: 30 },
    tiers: [
      {
        // The reliable haul: a generous 2–4 sub-parts (richer than the pile's 50%/1–3) — clearing a
        // camp should feel like a real find, not a maybe.
        id: 'sub-part',
        label: 'Sub-part',
        rarity: 'common',
        source: 'empty-roll',
        chance: 1,
        count: { min: 2, max: 4 },
        pool: SUB_PART_POOL,
        enabled: true,
      },
      {
        // STUB — a rare whole assembled part. Dormant until the grant-a-product path lands (shared with
        // the pile table's stub).
        id: 'full-part',
        label: 'Full part',
        rarity: 'rare',
        source: 'empty-roll',
        chance: 0.05,
        count: { min: 1, max: 1 },
        pool: [],
        enabled: false,
      },
      {
        // STUB — an epic recipe/gold tier. Dormant until that system exists.
        id: 'recipe',
        label: 'Recipe',
        rarity: 'epic',
        source: 'empty-roll',
        chance: 0.01,
        count: { min: 1, max: 1 },
        pool: [],
        enabled: false,
      },
    ],
  },
};

/** A rolled camp payout: the scrap to bank and the part finds to reveal + grant. */
export interface CampLootRoll {
  walletScrap: number;
  finds: LootFind[];
}

/** Roll a camp's FULL payout — wallet scrap (a range) plus every tier's part finds. PURE given its
 *  `rng`. The clean-success payout; `rollCampLootForOutcome` gates it down for a partial/fail disarm. */
export function rollCampLoot(table: CampLootTable, rng: () => number = Math.random): CampLootRoll {
  return { walletScrap: rollCount(table.walletScrap, rng), finds: rollTable(table.tiers, rng) };
}

/**
 * Roll a camp's payout GATED by the disarm outcome (spec §5/§7):
 *   - `success` → the full table + the full wallet-scrap chunk (= `rollCampLoot`).
 *   - `partial` → only the common-rarity tiers, and a HALVED wallet-scrap chunk. (Today only the common
 *     sub-part tier is enabled, so the scrap cut is what makes a partial bite; the rare/epic gating
 *     starts mattering the moment those stub tiers are enabled.)
 *   - `fail`    → nothing at all (`null` — no `LootDrop` queued).
 * PURE given its `rng`; the `rng` is drawn in the same order as `rollCampLoot` (scrap, then tiers).
 */
export function rollCampLootForOutcome(
  table: CampLootTable,
  grade: DisarmGrade,
  rng: () => number = Math.random,
): CampLootRoll | null {
  if (grade === 'fail') return null;
  if (grade === 'success') return rollCampLoot(table, rng);
  const commonTiers = table.tiers.filter((t) => t.rarity === 'common');
  const halfScrap = {
    min: Math.round(table.walletScrap.min / 2),
    max: Math.round(table.walletScrap.max / 2),
  };
  return { walletScrap: rollCount(halfScrap, rng), finds: rollTable(commonTiers, rng) };
}

/** Resolve a loot id to its table, falling back to level 1 for an unknown id. */
export function campLootTable(id: string): CampLootTable {
  return CAMP_LOOT[id] ?? CAMP_LOOT['level-1']!;
}
