import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Part } from '@common/components/part';
import { Mount } from '@common/components/mount';
import { Collider } from '@common/components/collider';
import { Health } from '@common/components/health';
import { Enemy } from './enemy';
import { Weapon } from './weapon';
import { Projectile } from './projectile';
import { weaponFireSystem } from './weapon-fire-system';

/** A rig carrying a mounted weapon at the origin facing local −Z (rotationY 0). Returns [rig, weapon]. */
function rigWithWeapon(world: World): [EntityId, EntityId] {
  const rig = world.createEntity();
  world.add(rig, Transform, { x: 0, z: 0, rotationY: 0 });
  const w = world.createEntity();
  world.add(w, Part, { kind: 'weapon' });
  world.add(w, Mount, { rig, col: 0, row: 0, yaw: 0 });
  world.add(w, Transform, { x: 0, z: 0, rotationY: 0 }); // front = −Z
  return [rig, w];
}

function enemyAt(world: World, x: number, z: number): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, Collider, { radius: 0.6 });
  world.add(e, Health, { current: 30, max: 30 });
  world.add(e, Enemy, { camp: 0 as EntityId });
  return e;
}

const rigShots = (world: World): EntityId[] =>
  world.query(Projectile).filter((p) => world.get(p, Projectile)!.team === 'rig');

describe('weaponFireSystem', () => {
  it('fires a rig shot at an enemy inside the forward cone + range, and aims the barrel at it', () => {
    const world = new World();
    const [rig, w] = rigWithWeapon(world);
    enemyAt(world, 0, -10); // 10u dead ahead (−Z), within range 18 and the cone
    weaponFireSystem(world, rig, 0.1);
    expect(rigShots(world)).toHaveLength(1);
    expect(world.get(w, Weapon)!.aimYaw).toBeCloseTo(0); // straight ahead
    expect(world.get(w, Weapon)!.cooldownLeft).toBeGreaterThan(0); // went on cooldown
  });

  it('does not fire at an enemy behind the gun (outside the cone) and clears the aim', () => {
    const world = new World();
    const [rig, w] = rigWithWeapon(world);
    enemyAt(world, 0, 10); // directly behind (+Z)
    weaponFireSystem(world, rig, 0.1);
    expect(rigShots(world)).toHaveLength(0);
    expect(world.get(w, Weapon)!.aimYaw).toBeNull();
  });

  it('respects the cooldown — one shot, not one per frame', () => {
    const world = new World();
    const [rig] = rigWithWeapon(world);
    enemyAt(world, 0, -10);
    weaponFireSystem(world, rig, 0.1); // fires
    weaponFireSystem(world, rig, 0.1); // still cooling down
    expect(rigShots(world)).toHaveLength(1);
  });

  it('does not fire at an enemy beyond range', () => {
    const world = new World();
    const [rig] = rigWithWeapon(world);
    enemyAt(world, 0, -30); // 30u ahead, past range 18
    weaponFireSystem(world, rig, 0.1);
    expect(rigShots(world)).toHaveLength(0);
  });
});
