import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Inventory, addToInventory, inventoryItems } from '@features/economy/inventory';
import { Wallet } from '@features/economy/wallet';
import { EnginePart } from '@common/parts/engine-part';
import { PART_COSTS } from '@features/workshop/part-costs';
import { PART_SHOP_STOCK } from '@features/workshop/part-shop';
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
  it('keeps the configurable cost list complete and valid', () => {
    const costIds = PART_COSTS.map((item) => item.partId).sort();
    // Every catalog part is shop-stocked, INCLUDING chassis sub-parts: a chassis is built on the
    // bench from bought sub-parts, then hauled out of the workshop as a kit, so each carries a cost.
    const sellableIds = PARTS_CATALOG.map((p) => p.id).sort();

    expect(costIds).toEqual(sellableIds);
    expect(PART_COSTS.some((c) => partDef(c.partId)?.category === 'chassis')).toBe(true);
    for (const item of PART_COSTS) {
      expect(partDef(item.partId)).toBeDefined();
      expect(item.buyCost).toBeGreaterThan(0);
    }
  });

  it('derives shop stock from the configurable cost list', () => {
    expect(PART_SHOP_STOCK).toEqual(
      PART_COSTS.map(({ partId, buyCost }) => ({ partId, cost: buyCost })),
    );
  });

  it('prices every engine part above the most expensive storage-container part', () => {
    const storageMax = Math.max(
      ...PART_SHOP_STOCK
        .filter((item) => partDef(item.partId)?.category === 'storage')
        .map((item) => item.cost),
    );
    const engineItems = PART_SHOP_STOCK.filter((item) => partDef(item.partId)?.category === 'engine');

    expect(engineItems).toHaveLength(8);
    expect(engineItems.every((item) => item.cost > storageMax)).toBe(true);
  });
});

describe('buyPart', () => {
  it('spends scrap and grants the bought part into inventory', () => {
    const world = setup(5);
    const result = buyPart(world, { partId: 'container-shell', cost: 3 });

    expect(result).toMatchObject({ ok: true, remainingScrap: 2 });
    const [item] = inventoryItems(world);
    expect(item).toBeDefined();
    expect(world.get(item!, EnginePart)).toEqual({ id: 'container-shell' });
    expect(world.get(world.query(Wallet)[0]!, Wallet)!.scrap).toBe(2);
  });

  it('refuses an unaffordable purchase without spawning a part', () => {
    const world = setup(1);
    const result = buyPart(world, { partId: 'container-rim', cost: 2 });

    expect(result).toEqual({ ok: false, reason: 'Need 2 scrap' });
    expect(inventoryItems(world)).toEqual([]);
    expect(world.query(EnginePart)).toEqual([]);
    expect(world.get(world.query(Wallet)[0]!, Wallet)!.scrap).toBe(1);
  });

  it('refuses unknown stock without touching the wallet', () => {
    const world = setup(10);

    expect(purchaseVerdict(world, { partId: 'missing', cost: 1 })).toEqual({
      ok: false,
      reason: 'Unknown part',
    });
    expect(buyPart(world, { partId: 'missing', cost: 1 })).toEqual({
      ok: false,
      reason: 'Unknown part',
    });
    expect(world.get(world.query(Wallet)[0]!, Wallet)!.scrap).toBe(10);
    expect(inventoryItems(world)).toEqual([]);
  });
});

describe('sellPart', () => {
  it('values resale at 50% rounded to the nearest whole scrap', () => {
    expect(resaleValue({ partId: 'container-rim', cost: 2 })).toBe(1);
    expect(resaleValue({ partId: 'container-shell', cost: 3 })).toBe(2);
    expect(resaleValue({ partId: 'm-coupling', cost: 7 })).toBe(4);
    expect(resaleValue({ partId: 'm-core', cost: 12 })).toBe(6);
  });

  it('sells an inventory-held loose part, credits scrap, and destroys the part entity', () => {
    const world = setup(0);
    const part = spawnCatalogPart(world, partDef('container-shell')!);
    addToInventory(world, part);

    const result = sellPart(world, part);

    expect(result).toEqual({ ok: true, scrapGained: 2, remainingScrap: 2 });
    expect(inventoryItems(world)).toEqual([]);
    expect(world.isAlive(part)).toBe(false);
    expect(world.get(world.query(Wallet)[0]!, Wallet)!.scrap).toBe(2);
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
