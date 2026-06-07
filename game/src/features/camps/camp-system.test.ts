import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { LootDrop } from '@common/components/loot-drop';
import { Health } from '@common/components/health';
import { Camp, type CampState } from './camp';
import { Enemy } from './enemy';
import { RestorableSite } from './restorable-site';
import { campSystem, resolveDisarm } from './camp-system';

function camp(world: World, state: CampState = 'guarded'): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x: 0, z: -50, rotationY: 0 });
  world.add(e, Camp, { level: 1, state });
  return e;
}

function guard(world: World, campId: EntityId): EntityId {
  const e = world.createEntity();
  world.add(e, Enemy, { camp: campId });
  return e;
}

function rig(world: World): EntityId {
  const e = world.createEntity();
  world.add(e, Health, { current: 100, max: 100 });
  return e;
}

const zero = (): number => 0; // deterministic roll: wallet scrap = min, sub-part tier drops min count

describe('campSystem (the GUARDED → DISARMABLE half)', () => {
  it('stays GUARDED while any guard lives', () => {
    const world = new World();
    const c = camp(world);
    guard(world, c);
    campSystem(world);
    expect(world.get(c, Camp)!.state).toBe('guarded');
  });

  it('becomes DISARMABLE when the last guard dies — but does NOT clear or pay out on its own', () => {
    const world = new World();
    const c = camp(world);
    const g = guard(world, c);
    world.destroyEntity(g); // last guard cleared

    campSystem(world);

    expect(world.get(c, Camp)!.state).toBe('disarmable');
    expect(world.query(LootDrop)).toHaveLength(0); // loot is gated behind a real disarm now
    expect(world.query(RestorableSite)).toHaveLength(0);
  });
});

describe('resolveDisarm (the DISARMABLE → CLEARED half)', () => {
  it('success: clears the camp with the FULL payout + a site, and no rig damage', () => {
    const world = new World();
    const c = camp(world, 'disarmable');
    const r = rig(world);

    const result = resolveDisarm(world, c, r, 'success', zero);

    expect(result).toEqual({ grade: 'success', damage: 0 });
    expect(world.get(c, Camp)!.state).toBe('cleared');
    expect(world.get(r, Health)!.current).toBe(100); // untouched

    const drops = world.query(LootDrop);
    expect(drops).toHaveLength(1);
    const drop = world.get(drops[0]!, LootDrop)!;
    expect(drop.walletScrap).toBe(15); // rng 0 → min of the full 15..30 range
    expect(drop.finds.length).toBeGreaterThanOrEqual(2);

    const sites = world.query(RestorableSite);
    expect(sites).toHaveLength(1);
    expect(world.get(sites[0]!, RestorableSite)!).toMatchObject({ kind: 'camp', sourceLevel: 1 });
  });

  it('partial: clears with a HALVED scrap chunk + damage (rng 0 → the trap nicks you)', () => {
    const world = new World();
    const c = camp(world, 'disarmable');
    const r = rig(world);

    const result = resolveDisarm(world, c, r, 'partial', zero);

    expect(result.grade).toBe('partial');
    expect(result.damage).toBe(15);
    expect(world.get(c, Camp)!.state).toBe('cleared');
    expect(world.get(r, Health)!.current).toBe(85); // 100 − 15

    const drop = world.get(world.query(LootDrop)[0]!, LootDrop)!;
    expect(drop.walletScrap).toBe(8); // rng 0 → min of the halved 8..15 range
    expect(world.query(RestorableSite)).toHaveLength(1);
  });

  it('fail: clears with NO loot, a site, and the full trap-sprung damage', () => {
    const world = new World();
    const c = camp(world, 'disarmable');
    const r = rig(world);

    const result = resolveDisarm(world, c, r, 'fail', zero);

    expect(result).toEqual({ grade: 'fail', damage: 30 });
    expect(world.get(c, Camp)!.state).toBe('cleared');
    expect(world.get(r, Health)!.current).toBe(70); // 100 − 30
    expect(world.query(LootDrop)).toHaveLength(0); // a botched disarm yields nothing
    expect(world.query(RestorableSite)).toHaveLength(1); // but the trap is still dealt with
  });

  it('is a no-op on a camp that is not DISARMABLE (guards against a double-resolve)', () => {
    const world = new World();
    const c = camp(world, 'cleared');
    const r = rig(world);

    const result = resolveDisarm(world, c, r, 'success', zero);

    expect(result).toEqual({ grade: 'success', damage: 0 });
    expect(world.query(LootDrop)).toHaveLength(0);
    expect(world.query(RestorableSite)).toHaveLength(0);
    expect(world.get(r, Health)!.current).toBe(100);
  });
});
