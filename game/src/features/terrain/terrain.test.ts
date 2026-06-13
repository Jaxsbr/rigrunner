import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { Solid } from '@common/components/solid';
import { Renderable } from '@common/components/renderable';
import { spawnMountainRing, MOUNTAIN_RING_RADIUS, type MountainGap } from './mountain-ring';
import { worldBoundsSystem } from './world-bounds';
import { WORLD_RADIUS } from '@common/render/stage';

const GAPS: MountainGap[] = [
  { angle: 0, halfWidth: 0.075 },
  { angle: 2.3, halfWidth: 0.075 },
  { angle: 4.2, halfWidth: 0.075 },
];

const angle = (x: number, z: number): number => Math.atan2(z, x);
const angularDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b) % (Math.PI * 2);
  return d > Math.PI ? Math.PI * 2 - d : d;
};

describe('spawnMountainRing', () => {
  it('places ONE continuous ridge mesh at the origin — a visual with no collider of its own', () => {
    const world = new World();
    spawnMountainRing(world, GAPS);

    const meshes = world.query(Renderable, Transform).filter(
      (e) => { const r = world.get(e, Renderable)!; return r.shape === 'model' && r.assetId === 'mountain-range'; },
    );
    expect(meshes).toHaveLength(1);
    const t = world.get(meshes[0]!, Transform)!;
    expect([t.x, t.z]).toEqual([0, 0]);     // one mesh, at the origin
    expect(world.has(meshes[0]!, Solid)).toBe(false); // the mesh blocks nothing — the collider ring does
  });

  it('lays an overlapping ring of Solid colliders along the ridge centreline', () => {
    const world = new World();
    spawnMountainRing(world, GAPS);

    const colliders = world.query(Solid, Collider, Transform);
    expect(colliders.length).toBeGreaterThan(20); // a real barrier, not a handful
    for (const c of colliders) {
      const t = world.get(c, Transform)!;
      expect(Math.hypot(t.x, t.z)).toBeCloseTo(MOUNTAIN_RING_RADIUS, 5); // all on the ring
      expect(world.has(c, Renderable)).toBe(false); // invisible — the mesh is the visual
    }
  });

  it('leaves the exit gaps open — no blocker sits within a gap', () => {
    const world = new World();
    spawnMountainRing(world, GAPS);

    for (const c of world.query(Solid, Transform)) {
      const t = world.get(c, Transform)!;
      const a = angle(t.x, t.z);
      for (const g of GAPS) {
        expect(angularDistance(a, g.angle)).toBeGreaterThanOrEqual(g.halfWidth); // never inside a gap
      }
    }
  });

  it('still blocks BETWEEN the gaps (the barrier is continuous, not all gap)', () => {
    const world = new World();
    spawnMountainRing(world, GAPS);
    // A direction with no gap (≈ π) must carry a blocker near it.
    const near = world.query(Solid, Transform).some((c) => {
      const t = world.get(c, Transform)!;
      return angularDistance(angle(t.x, t.z), Math.PI) < 0.2;
    });
    expect(near).toBe(true);
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
