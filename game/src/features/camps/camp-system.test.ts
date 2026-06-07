import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { LootDrop } from '@common/components/loot-drop';
import { Camp } from './camp';
import { Enemy } from './enemy';
import { RestorableSite } from './restorable-site';
import { campSystem } from './camp-system';

function camp(world: World): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x: 0, z: -50, rotationY: 0 });
  world.add(e, Camp, { level: 1, state: 'guarded' });
  return e;
}

function guard(world: World, campId: EntityId): EntityId {
  const e = world.createEntity();
  world.add(e, Enemy, { camp: campId });
  return e;
}

const zero = (): number => 0; // deterministic roll: wallet scrap = min, sub-part tier drops min count

describe('campSystem', () => {
  it('stays GUARDED while any guard lives', () => {
    const world = new World();
    const c = camp(world);
    guard(world, c);
    campSystem(world, zero);
    expect(world.get(c, Camp)!.state).toBe('guarded');
    expect(world.query(LootDrop)).toHaveLength(0);
  });

  it('clears the instant the last guard dies (Phase-1 auto-disarm), paying out loot + a site', () => {
    const world = new World();
    const c = camp(world);
    const g = guard(world, c);
    world.destroyEntity(g); // last guard cleared

    campSystem(world, zero);

    expect(world.get(c, Camp)!.state).toBe('cleared');

    const drops = world.query(LootDrop);
    expect(drops).toHaveLength(1);
    const drop = world.get(drops[0]!, LootDrop)!;
    expect(drop.walletScrap).toBe(15); // rng 0 → min of 15..30, banked to the wallet
    expect(drop.finds.length).toBeGreaterThanOrEqual(2); // generous sub-part roll
    expect(drop.scrap).toBe(0); // a camp scatters nothing

    const sites = world.query(RestorableSite);
    expect(sites).toHaveLength(1);
    expect(world.get(sites[0]!, RestorableSite)!).toMatchObject({ kind: 'camp', sourceLevel: 1 });
  });

  it('pays out only once — a cleared camp is idle on later ticks', () => {
    const world = new World();
    camp(world); // no guards on it → clears on the first tick
    campSystem(world, zero); // no guards → clears
    campSystem(world, zero); // idempotent
    expect(world.query(LootDrop)).toHaveLength(1);
    expect(world.query(RestorableSite)).toHaveLength(1);
  });
});
