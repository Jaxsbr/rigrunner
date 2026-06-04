import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { collisionSystem } from './collision';

function collider(world: World, x: number, z: number, radius: number): EntityId {
  const e = world.createEntity();
  world.add(e, Transform, { x, z, rotationY: 0 });
  world.add(e, Collider, { radius });
  return e;
}

/** True if the pair list contains {a,b} in either order. */
function hasPair(pairs: { a: EntityId; b: EntityId }[], x: EntityId, y: EntityId): boolean {
  return pairs.some((p) => (p.a === x && p.b === y) || (p.a === y && p.b === x));
}

describe('collisionSystem', () => {
  it('reports a pair when two circles overlap', () => {
    const world = new World();
    const a = collider(world, 0, 0, 0.5);
    const b = collider(world, 0.5, 0, 0.5); // centres 0.5 apart < 1.0 combined radius
    expect(hasPair(collisionSystem(world), a, b)).toBe(true);
  });

  it('reports no pair when circles are clear of each other', () => {
    const world = new World();
    collider(world, 0, 0, 0.5);
    collider(world, 5, 0, 0.5);
    expect(collisionSystem(world)).toEqual([]);
  });

  it('treats touching circles (distance == combined radius) as NOT overlapping', () => {
    const world = new World();
    collider(world, 0, 0, 0.5);
    collider(world, 1, 0, 0.5); // distance 1.0 exactly == 0.5 + 0.5
    expect(collisionSystem(world)).toEqual([]);
  });

  it('uses planar distance — height/diagonal across x and z both count', () => {
    const world = new World();
    const a = collider(world, 0, 0, 0.8);
    const b = collider(world, 0.5, 0.5, 0.8); // dist ≈ 0.707 < 1.6
    expect(hasPair(collisionSystem(world), a, b)).toBe(true);
  });

  it('returns each overlapping pair once, not twice', () => {
    const world = new World();
    collider(world, 0, 0, 0.5);
    collider(world, 0.2, 0, 0.5);
    expect(collisionSystem(world)).toHaveLength(1);
  });

  it('ignores entities without a Collider', () => {
    const world = new World();
    const a = collider(world, 0, 0, 0.5);
    const lone = world.createEntity();
    world.add(lone, Transform, { x: 0, z: 0, rotationY: 0 }); // Transform but no Collider
    const pairs = collisionSystem(world);
    expect(pairs.every((p) => p.a !== lone && p.b !== lone)).toBe(true);
    expect(pairs).toEqual([]); // a alone can't pair with anything
    expect(a).toBeGreaterThan(0);
  });

  it('reports all pairs among three mutually overlapping colliders', () => {
    const world = new World();
    const a = collider(world, 0, 0, 1);
    const b = collider(world, 0.3, 0, 1);
    const c = collider(world, 0, 0.3, 1);
    const pairs = collisionSystem(world);
    expect(pairs).toHaveLength(3);
    expect(hasPair(pairs, a, b)).toBe(true);
    expect(hasPair(pairs, a, c)).toBe(true);
    expect(hasPair(pairs, b, c)).toBe(true);
  });
});
