import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Health } from '@common/components/health';
import { Enemy, EnemyAI, type EnemyState } from './enemy';
import { Projectile } from './projectile';
import { enemyAiSystem } from './enemy-ai-system';

function rigAt(world: World, x: number, z: number): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  return e;
}

function camp(world: World, x = 0, z = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  return e;
}

function guard(world: World, campId: EntityId, x: number, z: number, state: EnemyState, fireCooldownLeft = 0): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, Health, { current: 30, max: 30 });
  world.add(e, Enemy, { camp: campId });
  world.add(e, EnemyAI, {
    state, postX: x, postZ: z, detection: 16, leash: 28, moveSpeed: 4,
    damage: 6, fireInterval: 1.5, projectileSpeed: 10, fireCooldownLeft,
  });
  return e;
}

const stateOf = (world: World, e: EntityId): EnemyState => world.get(e, EnemyAI)!.state;
const enemyShots = (world: World): EntityId[] =>
  world.query(Projectile).filter((p) => world.get(p, Projectile)!.team === 'enemy');

describe('enemyAiSystem', () => {
  it('wakes from GUARD to ENGAGE when the rig enters the detection radius', () => {
    const world = new World();
    const c = camp(world);
    const e = guard(world, c, 3, 0, 'guard');
    enemyAiSystem(world, rigAt(world, 5, 0), 0.1); // 2u from the guard ≤ 16
    expect(stateOf(world, e)).toBe('engage');
  });

  it('stays GUARD while the rig is out of detection', () => {
    const world = new World();
    const c = camp(world);
    const e = guard(world, c, 3, 0, 'guard');
    enemyAiSystem(world, rigAt(world, 40, 0), 0.1);
    expect(stateOf(world, e)).toBe('guard');
  });

  it('ENGAGE pursues the rig and fires a travelling shot when off cooldown', () => {
    const world = new World();
    const c = camp(world);
    const e = guard(world, c, 0, 0, 'engage', 0);
    enemyAiSystem(world, rigAt(world, 10, 0), 0.5);
    expect(world.get(e, Transform)!.x).toBeGreaterThan(0); // stepped toward the rig (+X)
    expect(enemyShots(world)).toHaveLength(1);
    expect(world.get(e, EnemyAI)!.fireCooldownLeft).toBeCloseTo(1.5); // reset to the interval
  });

  it('breaks to RETREAT when the rig is past the leash measured from the camp', () => {
    const world = new World();
    const c = camp(world, 0, 0);
    const e = guard(world, c, 3, 0, 'engage');
    world.get(e, Transform)!.x = 12; // chased out, away from its post (3,0) — so RETREAT is observable
    enemyAiSystem(world, rigAt(world, 40, 0), 0.1); // 40 > leash 28 (from camp)
    expect(stateOf(world, e)).toBe('retreat'); // heading home, not yet arrived
  });

  it('RETREAT returns to post and resumes GUARD on arrival', () => {
    const world = new World();
    const c = camp(world);
    const e = guard(world, c, 3, 0, 'retreat'); // already standing on its post
    enemyAiSystem(world, rigAt(world, 60, 0), 0.1); // rig far away → not re-engaging
    expect(stateOf(world, e)).toBe('guard');
  });
});
