import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Inventory, addToInventory, inventoryItems } from '@features/economy/inventory';
import { Wallet } from '@features/economy/wallet';
import { EnginePart } from '@common/parts/engine-part';
import { PART_COSTS } from '@features/workshop/part-costs';
import { shopStockForTier, shopItemForPart, tieredCost } from '@features/workshop/part-shop';
import { PARTS_CATALOG, partDef, spawnCatalogPart } from '@common/parts/parts-catalog';
import { buyPart, purchaseVerdict, resaleValue, sellPart } from './shop';

function setup(scrap: number): World {
  const world = new World();
  const store = world.createEntity();
  world.add(store, Wallet, { scrap });
  world.add(store, Inventory, { items: [] });
  return world;
}

describe('part shop stock', () => {
  it('stocks every catalog part at a given tier, all priced above zero', () => {
    const stock = shopStockForTier('rusty');
    const stockIds = stock.map((item) => item.partId).sort();
    // Every catalog part is shop-stocked, INCLUDING chassis sub-parts: a chassis is built on the
    // bench from bought sub-parts, then hauled out of the workshop as a kit, so each carries a cost.
    const catalogIds = PARTS_CATALOG.map((p) => p.id).sort();

    expect(stockIds).toEqual(catalogIds);
    expect(stock.some((item) => partDef(item.partId)?.category === 'chassis')).toBe(true);
    for (const item of stock) {
      expect(partDef(item.partId)).toBeDefined();
      expect(item.cost).toBeGreaterThan(0);
      expect(item.tier).toBe('rusty');
    }
  });

  it('prices a steeper tier above its base — iron costs more than rusty for the same part', () => {
    for (const { partId, buyCost } of PART_COSTS) {
      const rusty = shopItemForPart(partId, 'rusty')!;
      const iron = shopItemForPart(partId, 'iron')!;
      expect(rusty.cost).toBe(buyCost); // tier-1 is the base price, unscaled
      expect(iron.cost).toBeGreaterThan(rusty.cost); // the steep ladder makes iron dearer
      expect(iron.cost).toBe(tieredCost(buyCost, 'iron'));
    }
  });

  it('prices every engine part above the most expensive storage-container part (at one tier)', () => {
    const stock = shopStockForTier('rusty');
    const storageMax = Math.max(
      ...stock.filter((item) => partDef(item.partId)?.category === 'storage').map((item) => item.cost),
    );
    const engineItems = stock.filter((item) => partDef(item.partId)?.category === 'engine');

    expect(engineItems).toHaveLength(8);
    expect(engineItems.every((item) => item.cost > storageMax)).toBe(true);
  });
});

describe('buyPart', () => {
  it('spends scrap and grants the bought part into inventory at the rusty tier', () => {
    const world = setup(5);
    const result = buyPart(world, shopItemForPart('container-shell', 'rusty')!);

    expect(result).toMatchObject({ ok: true, remainingScrap: 2 }); // 5 − 3
    const [item] = inventoryItems(world);
    expect(item).toBeDefined();
    expect(world.get(item!, EnginePart)).toEqual({ id: 'container-shell', tier: 'rusty' });
    expect(world.get(world.query(Wallet)[0]!, Wallet)!.scrap).toBe(2);
  });

  it('mints an IRON part when the iron item is bought — the tier rides on the instance', () => {
    const ironShell = shopItemForPart('container-shell', 'iron')!; // round(3 × 1.8) = 5 scrap
    const world = setup(ironShell.cost);
    const result = buyPart(world, ironShell);

    expect(result).toMatchObject({ ok: true, remainingScrap: 0 });
    const [item] = inventoryItems(world);
    expect(world.get(item!, EnginePart)).toEqual({ id: 'container-shell', tier: 'iron' });
  });

  it('refuses an unaffordable purchase without spawning a part', () => {
    const world = setup(1);
    const result = buyPart(world, shopItemForPart('container-rim', 'rusty')!); // costs 2

    expect(result).toEqual({ ok: false, reason: 'Need 2 scrap' });
    expect(inventoryItems(world)).toEqual([]);
    expect(world.query(EnginePart)).toEqual([]);
    expect(world.get(world.query(Wallet)[0]!, Wallet)!.scrap).toBe(1);
  });

  it('refuses unknown stock without touching the wallet', () => {
    const world = setup(10);
    const bogus = { partId: 'missing', tier: 'rusty' as const, cost: 1 };

    expect(purchaseVerdict(world, bogus)).toEqual({ ok: false, reason: 'Unknown part' });
    expect(buyPart(world, bogus)).toEqual({ ok: false, reason: 'Unknown part' });
    expect(world.get(world.query(Wallet)[0]!, Wallet)!.scrap).toBe(10);
    expect(inventoryItems(world)).toEqual([]);
  });
});

describe('sellPart', () => {
  it('values resale at 50% rounded to the nearest whole scrap', () => {
    expect(resaleValue({ partId: 'container-rim', tier: 'rusty', cost: 2 })).toBe(1);
    expect(resaleValue({ partId: 'container-shell', tier: 'rusty', cost: 3 })).toBe(2);
    expect(resaleValue({ partId: 's-driveshaft', tier: 'rusty', cost: 7 })).toBe(4);
    expect(resaleValue({ partId: 's-piston', tier: 'rusty', cost: 12 })).toBe(6);
  });

  it('sells an inventory-held loose part, credits scrap, and destroys the part entity', () => {
    const world = setup(0);
    const part = spawnCatalogPart(world, partDef('container-shell')!); // rusty
    addToInventory(world, part);

    const result = sellPart(world, part);

    expect(result).toEqual({ ok: true, scrapGained: 2, remainingScrap: 2 }); // 50% of 3 → 2
    expect(inventoryItems(world)).toEqual([]);
    expect(world.isAlive(part)).toBe(false);
    expect(world.get(world.query(Wallet)[0]!, Wallet)!.scrap).toBe(2);
  });

  it('values an iron part for resale by its own tier — it sells back for more than a rusty one', () => {
    const world = setup(0);
    const iron = spawnCatalogPart(world, partDef('container-shell')!, 'iron');
    addToInventory(world, iron);

    const result = sellPart(world, iron);

    // iron shell buys at round(3 × 1.8) = 5, resells at round(5 / 2) = 3 — above a rusty shell's 2.
    expect(result).toMatchObject({ ok: true, scrapGained: 3 });
  });

  it('refuses to sell an entity that is not in inventory', () => {
    const world = setup(0);
    const part = spawnCatalogPart(world, partDef('container-rim')!);

    expect(sellPart(world, part)).toEqual({ ok: false, reason: 'Not in inventory' });
    expect(world.isAlive(part)).toBe(true);
    expect(world.get(world.query(Wallet)[0]!, Wallet)!.scrap).toBe(0);
  });

  it('refuses to sell assembled products through the loose-part resale path', () => {
    const world = setup(0);
    const product = world.createEntity();
    addToInventory(world, product);

    expect(sellPart(world, product)).toEqual({ ok: false, reason: 'Only loose parts can be sold' });
    expect(inventoryItems(world)).toEqual([product]);
    expect(world.isAlive(product)).toBe(true);
  });
});
