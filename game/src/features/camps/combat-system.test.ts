import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import type { CollisionPair } from '@common/sim/collision';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Mount } from '@common/components/mount';
import { Part } from '@common/components/part';
import { Health } from '@common/components/health';
import { Enemy } from './enemy';
import { Projectile } from './projectile';
import { combatSystem } from './combat-system';

function rig(world: World): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x: 0, z: 0, rotationY: 0 });
  world.add(e, Collider, { radius: 1 });
  world.add(e, Health, { current: 100, max: 100 });
  return e;
}

function mountedPart(world: World, r: EntityId): EntityId {
  const e = world.createEntity();
  world.add(e, Part, { kind: 'weapon' });
  world.add(e, Mount, { rig: r, col: 0, row: 0, yaw: 0 });
  world.add(e, Transform, { x: 0, z: 0, rotationY: 0 });
  world.add(e, Collider, { radius: 0.5 });
  return e;
}

function enemy(world: World, hp = 30): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x: 5, z: 0, rotationY: 0 });
  world.add(e, Collider, { radius: 0.6 });
  world.add(e, Health, { current: hp, max: hp });
  world.add(e, Enemy, { camp: 0 as EntityId });
  return e;
}

function projectile(world: World, team: 'rig' | 'enemy', damage: number): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x: 0, z: 0, rotationY: 0 });
  world.add(e, Collider, { radius: 0.25 });
  world.add(e, Projectile, { team, damage, vx: 0, vz: 0, ttl: 1 });
  return e;
}

const pair = (a: EntityId, b: EntityId): CollisionPair[] => [{ a, b }];

describe('combatSystem', () => {
  it('a rig shot damages an enemy and is consumed; the enemy dies at 0 HP', () => {
    const world = new World();
    const r = rig(world);
    const e = enemy(world, 30);
    const shot = projectile(world, 'rig', 10);
    combatSystem(world, r, pair(shot, e));
    expect(world.get(e, Health)!.current).toBe(20);
    expect(world.isAlive(shot)).toBe(false);

    const kill = projectile(world, 'rig', 30);
    combatSystem(world, r, pair(kill, e));
    expect(world.isAlive(e)).toBe(false);
  });

  it('an enemy shot damages the rig (via the chassis OR a mounted part) but never destroys it', () => {
    const world = new World();
    const r = rig(world);
    const part = mountedPart(world, r);

    combatSystem(world, r, pair(projectile(world, 'enemy', 6), r));
    expect(world.get(r, Health)!.current).toBe(94);

    combatSystem(world, r, pair(projectile(world, 'enemy', 6), part)); // hitting a mounted part counts
    expect(world.get(r, Health)!.current).toBe(88);
    expect(world.isAlive(r)).toBe(true);
  });

  it('ramming an enemy with the rig body instantly kills it (no rig self-damage)', () => {
    const world = new World();
    const r = rig(world);
    const e = enemy(world);
    combatSystem(world, r, pair(r, e));
    expect(world.isAlive(e)).toBe(false);
    expect(world.get(r, Health)!.current).toBe(100); // untouched
  });

  it('no friendly fire — a rig shot ignores the rig, an enemy shot ignores its own kind', () => {
    const world = new World();
    const r = rig(world);
    const e = enemy(world, 30);
    const rigShot = projectile(world, 'rig', 10);
    const enemyShot = projectile(world, 'enemy', 10);
    combatSystem(world, r, pair(rigShot, r)); // rig shot overlapping the rig (spawn frame)
    combatSystem(world, r, pair(enemyShot, e)); // enemy shot overlapping its firer
    expect(world.get(r, Health)!.current).toBe(100);
    expect(world.get(e, Health)!.current).toBe(30);
    expect(world.isAlive(rigShot)).toBe(true);
    expect(world.isAlive(enemyShot)).toBe(true);
  });
});
