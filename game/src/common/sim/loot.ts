/**
 * The shared loot ROLLER — the generic, data-driven core of "roll a table for its finds", with no
 * knowledge of what's being looted. A loot table is a list of independent `LootTier`s; `rollTable`
 * processes the `empty-roll` ones (each an independent chance → a random count drawn from its pool).
 *
 * A `@common/sim` primitive (ADR-003): two features roll through it — scrap (an emptied pile) and camps
 * (a cleared camp) — over their OWN tables (`@features/scrap/loot-table`, `@features/camps/camp-loot`),
 * so the data lives with each feature and only the machinery is shared. This is the reuse Option C's
 * loot table was built to enable. PURE given its `rng`, so a seeded sequence makes every roll testable.
 */

export type LootRarity = 'guaranteed' | 'common' | 'rare' | 'epic';

export interface LootTier {
  /** Stable id for the tier. */
  id: string;
  /** Human label (shown in the loot UI as the find's tier). */
  label: string;
  /** Rarity band — drives the loot UI's colour/sort and reads the tier's intent. */
  rarity: LootRarity;
  /** Where the tier's loot enters play: scattered during a dig (`burst`) or rolled on clear. */
  source: 'burst' | 'empty-roll';
  /** Probability (0..1) this tier drops on a single roll. Ignored for `burst` tiers. */
  chance: number;
  /** How many items the tier yields when it drops (inclusive range; drawn with replacement). */
  count: { min: number; max: number };
  /** Candidate ids the tier draws from — catalog part ids today, recipe ids when that lands. */
  pool: readonly string[];
  /** A dormant STUB when false: carried for shape/visibility but never drops (system not built). */
  enabled: boolean;
}

/** One rolled find — the tier it came from plus the drawn id. The loot UI turns these into grants. */
export interface LootFind {
  tierId: string;
  rarity: LootRarity;
  /** The catalog/recipe id drawn from the tier's pool. */
  itemId: string;
}

/** A uniform integer in `[range.min, range.max]` inclusive — the shared count roller for all tiers. */
export function rollCount(range: { min: number; max: number }, rng: () => number): number {
  return range.min + Math.floor(rng() * (range.max - range.min + 1));
}

/**
 * Roll a loot table's `empty-roll` tiers into a flat find list. For every enabled `empty-roll` tier
 * with a non-empty pool, roll its `chance`; on success draw a random count in the tier's range, each
 * pick uniform over the pool (with replacement, so a roll can yield two of the same item). Tiers don't
 * compete — one roll can yield from several (or none). `burst` tiers are skipped (they're scattered as
 * they're worked, not granted on clear). Returns the flat list (empty when nothing rolled).
 */
export function rollTable(tiers: readonly LootTier[], rng: () => number): LootFind[] {
  const finds: LootFind[] = [];
  for (const tier of tiers) {
    if (tier.source !== 'empty-roll' || !tier.enabled || tier.pool.length === 0) continue;
    if (rng() >= tier.chance) continue; // tier didn't drop this roll
    const n = rollCount(tier.count, rng);
    for (let i = 0; i < n; i++) {
      const itemId = tier.pool[Math.floor(rng() * tier.pool.length)]!;
      finds.push({ tierId: tier.id, rarity: tier.rarity, itemId });
    }
  }
  return finds;
}
