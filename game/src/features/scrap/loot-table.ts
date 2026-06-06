import { SUB_PART_POOL } from '@common/parts/parts-catalog';
import { rollCount, rollTable, type LootTier, type LootFind } from '@common/sim/loot';

/**
 * The scrap-pile LOOT TABLE (Option C / PR5) — the single, data-driven config for what rummaging an
 * emptied pile yields. Tuning the rewards is a data change here, never a code change in the rummage
 * system or the loot UI. The roller itself (`rollTable`/`rollCount`, the `LootTier`/`LootFind` shapes)
 * is the shared `@common/sim/loot` kernel; this module is just the scrap-specific table that rolls
 * through it — the SAME kernel a cleared camp rolls its own table through (`@features/camps/camp-loot`).
 *
 * A pile's yield comes from two distinct moments, and the table names both for one readable picture:
 *
 *   - `source: 'burst'`   — scattered DURING the rummage, wave by wave (the 100% scrap the heap is
 *     made of). This is realised by the rummage burst (`SCRAP_PER_WAVE` in `content/scrap.ts`), NOT
 *     by `rollLoot` — it's listed here only so the table reads as the complete picture of a pile's
 *     loot. `rollLoot` skips burst tiers so scrap is never double-granted.
 *   - `source: 'empty-roll'` — rolled ONCE when the pile is emptied (the hidden reward the loot UI
 *     reveals). `rollLoot` processes these.
 *
 * Each empty-roll tier is an independent chance: roll `chance`, and on success draw a random count in
 * `[count.min, count.max]` from the tier's `pool`. Tiers don't compete — a single empty can yield
 * from several tiers (or none). `enabled: false` carries a tier as a configured-but-dormant STUB:
 * the shape is fixed and visible, but it never drops until the system behind it lands (the full-part
 * and recipe tiers below are stubs — see their notes).
 */

// Re-export the loot shapes from the shared kernel so this module's existing importers (loot-drop,
// loot-overlay) keep one import site even though the canonical definitions now live in `@common/sim`.
export type { LootRarity, LootFind, LootTier } from '@common/sim/loot';
export { SUB_PART_POOL } from '@common/parts/parts-catalog';

/**
 * The loot table itself. Order is the display order in the loot UI. Today only the sub-part tier
 * actually drops; the full-part and recipe tiers are committed STUBS awaiting their systems.
 */
export const LOOT_TABLE: { readonly tiers: readonly LootTier[] } = {
  tiers: [
    {
      // The heap itself — 100% scrap, realised as the rummage burst (see scrap.ts), not rolled here.
      // `count` is the per-wave scatter range: each dig wave flings a random 1–3 loose-scrap pieces,
      // so a pile's total scrap is random (≈ waves × 1–3). Tune the scrap a pile gives here.
      id: 'scrap',
      label: 'Scrap',
      rarity: 'guaranteed',
      source: 'burst',
      chance: 1,
      count: { min: 1, max: 3 },
      pool: ['loose-scrap'],
      enabled: true,
    },
    {
      // The hidden reward: a 50% chance at 1–3 random loose sub-parts (an engine/storage building
      // block) — the "ooh, a find" beat the loot UI reveals when the pile clears. Held high (0.5)
      // while we're testing the loot loop; tune down once it's tuned for feel.
      id: 'sub-part',
      label: 'Sub-part',
      rarity: 'common',
      source: 'empty-roll',
      chance: 0.5,
      count: { min: 1, max: 3 },
      pool: SUB_PART_POOL,
      enabled: true,
    },
    {
      // STUB — a rare whole assembled part (a complete engine / container / Reclaimer). Granting a
      // finished product means composing an Assembly on grant; that path isn't wired for loot yet, so
      // the tier is carried dormant (empty pool, disabled) until it lands.
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
      // STUB — an epic unique recipe (a blueprint you don't already own). The recipe-rarity system
      // isn't built (recipes are static today), so this tier is dormant until it exists.
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
};

/** The scrap (burst) tier — the per-wave scatter config, looked up once. */
const SCRAP_TIER = LOOT_TABLE.tiers.find((t) => t.id === 'scrap')!;

/**
 * Roll how many loose-scrap pieces ONE rummage wave scatters — a random count in the scrap tier's
 * range (config above). Summed across a pile's waves, this is the pile's (random) total scrap.
 * `rng` defaults to `Math.random`; tests inject a sequence for determinism.
 */
export function rollScrapBurst(rng: () => number = Math.random): number {
  return rollCount(SCRAP_TIER.count, rng);
}

/**
 * Roll the empty-roll loot for one cleared pile. PURE given its rng: for every enabled `empty-roll`
 * tier with a non-empty pool, roll its `chance`; on success draw a random count in the tier's range,
 * each pick uniform over the pool (with replacement, so a pile can yield two of the same sub-part).
 * Burst tiers (scrap) are skipped — they're scattered during the dig, not granted on empty.
 *
 * `rng` defaults to `Math.random`; tests pass a seeded sequence for determinism. Returns the flat
 * find list (empty when nothing rolled — at the 50% sub-part chance, about half the piles).
 */
export function rollLoot(rng: () => number = Math.random): LootFind[] {
  return rollTable(LOOT_TABLE.tiers, rng);
}
