import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Renderable } from '@common/components/renderable';
import { Collider } from '@common/components/collider';
import { spawnShopYard } from './shop-yard';

/** The (x,z) of every yard prop, as a stable signature for comparing two layouts. */
function layoutSig(world: World, ids: number[]): string {
  return ids
    .map((e) => {
      const t = world.get(e, Transform)!;
      const r = world.get(e, Renderable)! as { assetId: string; scale?: number };
      return `${r.assetId}@${t.x.toFixed(3)},${t.z.toFixed(3)}`;
    })
    .sort()
    .join('|');
}

describe('spawnShopYard', () => {
  it('scatters a full yard of model props with no colliders (pure decoration)', () => {
    const world = new World();
    const ids = spawnShopYard(world, 9, 5, 0);
    // "Eight tiles full of stuff" — a busy yard, not a couple of boxes.
    expect(ids.length).toBeGreaterThanOrEqual(14);
    for (const e of ids) {
      expect(world.get(e, Renderable)).toMatchObject({ shape: 'model' });
      expect(world.has(e, Transform)).toBe(true);
      expect(world.has(e, Collider)).toBe(false); // you drive THROUGH the yard; it never blocks
    }
  });

  it('places exactly one potted plant (the sign of life)', () => {
    const world = new World();
    const ids = spawnShopYard(world, 9, 5, 0);
    const plants = ids.filter((e) => (world.get(e, Renderable)! as { assetId: string }).assetId === 'yard-plant');
    expect(plants).toHaveLength(1);
  });

  it('is deterministic for a given shop, but differs shop to shop', () => {
    const a1 = new World();
    const a2 = new World();
    const b = new World();
    const sigA1 = layoutSig(a1, spawnShopYard(a1, 9, 5, Math.PI / 4));
    const sigA2 = layoutSig(a2, spawnShopYard(a2, 9, 5, Math.PI / 4)); // same shop → identical yard
    const sigB = layoutSig(b, spawnShopYard(b, -12, 3, Math.PI / 4)); // different spot → different yard
    expect(sigA1).toBe(sigA2);
    expect(sigA1).not.toBe(sigB);
  });

  it('keeps every prop within the yard footprint around the shop', () => {
    const world = new World();
    const sx = 9, sz = 5;
    const ids = spawnShopYard(world, sx, sz, (5 * Math.PI) / 4);
    for (const e of ids) {
      const t = world.get(e, Transform)!;
      const d = Math.hypot(t.x - sx, t.z - sz);
      expect(d).toBeLessThan(8); // the ring + stragglers stay in the shop's neighbourhood, not flung away
    }
  });
});
