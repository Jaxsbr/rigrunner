import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { EnginePart } from '@common/parts/engine-part';
import { addToInventory, getInventory, removeFromInventory } from '@features/economy/inventory';
import { getWallet } from '@features/economy/wallet';
import { partDef, spawnCatalogPart } from '@common/parts/parts-catalog';
import { shopItemForPartId, type PartShopItem } from '@features/workshop/part-shop';

export type PurchaseVerdict =
  | { ok: true }
  | { ok: false; reason: string };

export type PurchaseResult =
  | { ok: true; item: EntityId; remainingScrap: number }
  | { ok: false; reason: string };

export type SaleResult =
  | { ok: true; scrapGained: number; remainingScrap: number }
  | { ok: false; reason: string };

export function resaleValue(item: PartShopItem): number {
  return Math.max(1, Math.round(item.cost / 2));
}

/**
 * Pure-ish affordability check for a shop item. UI uses this to disable buttons; buyPart repeats it
 * before mutating so the transaction is still safe if the wallet changed since render.
 */
export function purchaseVerdict(world: World, item: PartShopItem): PurchaseVerdict {
  if (!Number.isFinite(item.cost) || item.cost <= 0) return { ok: false, reason: 'Invalid cost' };
  if (!partDef(item.partId)) return { ok: false, reason: 'Unknown part' };

  const wallet = getWallet(world);
  if (!wallet) return { ok: false, reason: 'No wallet' };
  if (wallet.scrap < item.cost) return { ok: false, reason: `Need ${item.cost} scrap` };

  return { ok: true };
}

/**
 * The minimum Option-B transaction seam: spend N scrap from Wallet, spawn the catalog part, and put
 * it in Inventory. It does not know about recipes, workshop tiers, fixtures, or unlocks.
 */
export function buyPart(world: World, item: PartShopItem): PurchaseResult {
  const verdict = purchaseVerdict(world, item);
  if (!verdict.ok) return verdict;

  const wallet = getWallet(world)!;
  const def = partDef(item.partId)!;
  wallet.scrap -= item.cost;

  const entity = spawnCatalogPart(world, def);
  addToInventory(world, entity);

  return { ok: true, item: entity, remainingScrap: wallet.scrap };
}

/**
 * Sell one loose catalog part from Inventory back to the shop at a loss. Only inventory-held
 * sub-parts are sellable; assembled products must be dismantled first so accounting stays explicit.
 */
export function sellPart(world: World, entity: EntityId): SaleResult {
  const wallet = getWallet(world);
  if (!wallet) return { ok: false, reason: 'No wallet' };

  const inv = getInventory(world);
  if (!inv || !inv.items.includes(entity)) return { ok: false, reason: 'Not in inventory' };

  const part = world.get(entity, EnginePart);
  if (!part) return { ok: false, reason: 'Only loose parts can be sold' };

  const item = shopItemForPartId(part.id);
  if (!item) return { ok: false, reason: 'No shop price' };

  const gained = resaleValue(item);
  removeFromInventory(world, entity);
  world.destroyEntity(entity);
  wallet.scrap += gained;

  return { ok: true, scrapGained: gained, remainingScrap: wallet.scrap };
}
