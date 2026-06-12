import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { WorldShop } from './world-shop';
import { shopZoneSystem } from './shop-zone-system';

function rig(world: World, x: number, z: number, radius = 1.2): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, Collider, { radius });
  return e;
}

function shop(world: World, x: number, z: number, radius = 3.5): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, WorldShop, { tier: 'rusty', radius, active: false });
  return e;
}

describe('shopZoneSystem', () => {
  it('activates when the rig circle overlaps the shop zone', () => {
    const world = new World();
    const s = shop(world, 0, 0, 3.5);
    const r = rig(world, 0, 4, 1.2); // dist 4 ≤ 3.5 + 1.2 = 4.7 → intersecting

    shopZoneSystem(world, r);
    expect(world.get(s, WorldShop)!.active).toBe(true);
  });

  it('stays dormant when the rig is out of reach', () => {
    const world = new World();
    const s = shop(world, 0, 0, 3.5);
    const r = rig(world, 0, 6, 1.2); // dist 6 > 4.7 → outside

    shopZoneSystem(world, r);
    expect(world.get(s, WorldShop)!.active).toBe(false);
  });

  it('counts the rig collider radius (circle-vs-circle, not centre-in-circle)', () => {
    const world = new World();
    const s = shop(world, 0, 0, 3.5);
    const r = rig(world, 0, 4.5, 1.2); // centre outside the bare 3.5, but its 1.2 radius reaches in

    shopZoneSystem(world, r);
    expect(world.get(s, WorldShop)!.active).toBe(true);
  });

  it('toggles back to dormant when the rig drives away', () => {
    const world = new World();
    const s = shop(world, 0, 0, 3.5);
    const r = rig(world, 0, 0, 1.2);

    shopZoneSystem(world, r);
    expect(world.get(s, WorldShop)!.active).toBe(true);

    world.get(r, Transform)!.z = 20; // drove off
    shopZoneSystem(world, r);
    expect(world.get(s, WorldShop)!.active).toBe(false);
  });
});
