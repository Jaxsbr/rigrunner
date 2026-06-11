import { partDef, type PartDef } from '@common/parts/parts-catalog';
import { tierOf, type TierId } from '@common/parts/tiers';
import { PART_COSTS } from './part-costs';

/**
 * The scrap spend sink: a tiny, data-driven stock list for workshop purchases, now tier-aware. The
 * shop is Phase 1's testable source of iron parts (`docs/part-identity-spec.md` §5/§6): the player
 * picks a tier in the overlay and the same catalog part is offered at that grade, priced up the
 * steeper the tier. `PART_COSTS` holds the base (rusty) price; the tier multiplier scales it, so
 * there is one price surface, not a hand-maintained price per tier.
 *
 * This stays intentionally just "part id + tier -> scrap cost". The future production chain can
 * replace the stock source (recipes, fixtures, smelter) while keeping the transaction seam in shop.ts.
 */
export interface PartShopItem {
  partId: string;
  tier: TierId;
  cost: number;
}

/** A part's base (rusty) price scaled to a tier — the steeper the tier, the dearer the part (§6). */
export function tieredCost(baseCost: number, tier: TierId): number {
  return Math.max(1, Math.round(baseCost * tierOf(tier).mult));
}

/** The base (rusty) price for a stocked catalog part, or undefined if it isn't sold. */
function baseCostOf(partId: string): number | undefined {
  return PART_COSTS.find((c) => c.partId === partId)?.buyCost;
}

/** The whole stock at a given tier — every stocked part, priced for that tier. */
export function shopStockForTier(tier: TierId): PartShopItem[] {
  return PART_COSTS.map(({ partId, buyCost }) => ({ partId, tier, cost: tieredCost(buyCost, tier) }));
}

/**
 * The shop line for one part at one tier — used to value a held instance for resale (its tier is on
 * its `EnginePart` vessel, so an iron part resells for more than a rusty one). Undefined if unstocked.
 */
export function shopItemForPart(partId: string, tier: TierId): PartShopItem | undefined {
  const base = baseCostOf(partId);
  return base === undefined ? undefined : { partId, tier, cost: tieredCost(base, tier) };
}

export function shopPartDef(item: PartShopItem): PartDef | undefined {
  return partDef(item.partId);
}
