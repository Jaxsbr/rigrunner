import { partDef, type PartDef } from '@common/parts/parts-catalog';
import { PART_COSTS } from './part-costs';

/**
 * The first scrap spend sink: a tiny, data-driven stock list for workshop purchases.
 *
 * This is intentionally just "scrap cost -> part id". The future production chain can replace the
 * stock source (recipes, fixtures, tiers) while keeping the transaction seam in systems/shop.ts.
 */
export interface PartShopItem {
  partId: string;
  cost: number;
}

export const PART_SHOP_STOCK: readonly PartShopItem[] = PART_COSTS.map(({ partId, buyCost }) => ({
  partId,
  cost: buyCost,
}));

export function shopItemForPartId(partId: string): PartShopItem | undefined {
  return PART_SHOP_STOCK.find((item) => item.partId === partId);
}

export function shopPartDef(item: PartShopItem): PartDef | undefined {
  return partDef(item.partId);
}
