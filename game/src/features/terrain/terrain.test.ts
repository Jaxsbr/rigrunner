import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Solid } from '@common/components/solid';
import { Renderable } from '@common/components/renderable';
import { spawnMountainRange } from './mountain-mesh';
import { worldBoundsSystem } from './world-bounds';
import { WORLD_RADIUS } from '@common/render/stage';

describe('spawnMountainRange', () => {
  it('places ONE ridge mesh at the origin — a pure visual with no collider (the grid does the blocking)', () => {
    const world = new World();
    spawnMountainRange(world);

    const meshes = world.query(Renderable, Transform).filter((e) => {
      const r = world.get(e, Renderable)!;
      return r.shape === 'model' && r.assetId === 'mountain-range';
    });
    expect(meshes).toHaveLength(1);
    const t = world.get(meshes[0]!, Transform)!;
    expect([t.x, t.z]).toEqual([0, 0]);
    // The mesh blocks nothing itself — the painted collision grid is the physical wall.
    expect(world.has(meshes[0]!, Solid)).toBe(false);
    expect(world.has(meshes[0]!, Collider)).toBe(false);
  });
});

describe('worldBoundsSystem', () => {
  it('pulls a rig past the world-end back onto the boundary, keeping its direction', () => {
    const world = new World();
    const rig = world.createEntity();
    world.add(rig, Transform, { x: 1000, z: 0, rotationY: 0 }); // way out in the void

    worldBoundsSystem(world, rig);

    const t = world.get(rig, Transform)!;
    expect(Math.hypot(t.x, t.z)).toBeCloseTo(WORLD_RADIUS - 3, 5); // clamped to the rim
    expect(t.z).toBe(0);   // same bearing (due +x)
    expect(t.x).toBeGreaterThan(0);
  });

  it('leaves a rig inside the world-end untouched', () => {
    const world = new World();
    const rig = world.createEntity();
    world.add(rig, Transform, { x: 10, z: -5, rotationY: 0 });

    worldBoundsSystem(world, rig);

    expect(world.get(rig, Transform)!).toMatchObject({ x: 10, z: -5 }); // well inside — unchanged
  });
});
