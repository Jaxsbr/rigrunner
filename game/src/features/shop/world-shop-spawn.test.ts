import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { PART_COSTS } from './part-costs';
import { WorldShop } from './world-shop';
import { spawnWorldShop, allStockedPartIds } from './world-shop-spawn';

describe('spawnWorldShop', () => {
  it('defaults to a rusty shop carrying every priced part, placed with a model + zone', () => {
    const world = new World();
    const e = spawnWorldShop(world, 10, 4);

    const t = world.get(e, Transform)!;
    expect({ x: t.x, z: t.z }).toEqual({ x: 10, z: 4 });
    expect(world.get(e, Renderable)).toMatchObject({ shape: 'model', assetId: 'shop' });

    const shop = world.get(e, WorldShop)!;
    expect(shop.tier).toBe('rusty');
    expect(shop.active).toBe(false);
    expect(shop.radius).toBeGreaterThan(0);
    // The first, sole shop carries the full priced list — relocating the workshop tab loses nothing.
    expect([...shop.stock].sort()).toEqual([...allStockedPartIds()].sort());
    expect(allStockedPartIds().sort()).toEqual(PART_COSTS.map((c) => c.partId).sort());
  });

  it('honours a partial/unique stock subset at a chosen tier (the later-shop seam)', () => {
    const world = new World();
    const e = spawnWorldShop(world, 0, 0, 'iron', ['reclaimer-arm', 'reclaimer-bucket']);

    const shop = world.get(e, WorldShop)!;
    expect(shop.tier).toBe('iron');
    expect(shop.stock).toEqual(['reclaimer-arm', 'reclaimer-bucket']);
  });

  it('faces its open front south-east (a diagonal, toward the fixed light) by default', () => {
    const world = new World();
    const yaw = world.get(spawnWorldShop(world, 9, 5), Transform)!.rotationY;
    expect(yaw).toBeCloseTo((5 * Math.PI) / 4, 9); // SE
    // A diagonal is an ODD multiple of π/4; a cardinal (0, π/2, π, 3π/2) is an even one.
    expect(Math.round(yaw / (Math.PI / 4)) % 2).toBe(1);
  });

  it('lets a caller pin a different diagonal (the override seam)', () => {
    const world = new World();
    const e = spawnWorldShop(world, 0, 0, 'rusty', undefined, Math.PI / 4); // NW
    expect(world.get(e, Transform)!.rotationY).toBe(Math.PI / 4);
  });
});
