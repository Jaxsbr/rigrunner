import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { WorldShop } from './world-shop';
import { spawnWorldShop } from './world-shop-spawn';

describe('spawnWorldShop', () => {
  it('defaults to a rusty shop, placed with a model + zone, and scatters its goods yard', () => {
    const world = new World();
    const e = spawnWorldShop(world, 10, 4);

    const t = world.get(e, Transform)!;
    expect({ x: t.x, z: t.z }).toEqual({ x: 10, z: 4 });
    expect(world.get(e, Renderable)).toMatchObject({ shape: 'model', assetId: 'shop' });

    const shop = world.get(e, WorldShop)!;
    expect(shop.tier).toBe('rusty');
    expect(shop.active).toBe(false);
    expect(shop.radius).toBeGreaterThan(0);

    // Spawning a shop also scatters its goods yard (decoration entities), so the world is the building +
    // a busy yard — not a bare container. Guards the spawn→yard wiring against silently dropping it.
    const renderables = world.query(Renderable);
    expect(renderables.length).toBeGreaterThan(14); // building + the ring of yard props
    const assetIds = renderables.map((id) => (world.get(id, Renderable) as { assetId: string }).assetId);
    expect(assetIds).toContain('yard-plant'); // the one potted plant — proof the yard layout ran
  });

  it('faces its open front south-east (a diagonal, toward the fixed light) by default', () => {
    const world = new World();
    const yaw = world.get(spawnWorldShop(world, 9, 5), Transform)!.rotationY;
    expect(yaw).toBeCloseTo((5 * Math.PI) / 4, 9); // SE
    // A diagonal is an ODD multiple of π/4; a cardinal (0, π/2, π, 3π/2) is an even one.
    expect(Math.round(yaw / (Math.PI / 4)) % 2).toBe(1);
  });

  it('lets a caller pin a different diagonal at a chosen tier (the override seam)', () => {
    const world = new World();
    const e = spawnWorldShop(world, 0, 0, 'iron', Math.PI / 4); // NW, iron grade
    expect(world.get(e, Transform)!.rotationY).toBe(Math.PI / 4);
    expect(world.get(e, WorldShop)!.tier).toBe('iron');
  });
});
