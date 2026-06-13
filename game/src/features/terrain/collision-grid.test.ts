import { describe, it, expect } from 'vitest';
import { World } from '@core/world';
import { Transform } from '@common/components/transform';
import { Collider } from '@common/components/collider';
import { CollisionGrid, gridBlockSystem } from './collision-grid';

/** A 10×10-cell grid, 2 units/cell, covering [-10,10] on x and z. */
function grid10(): CollisionGrid {
  return new CollisionGrid({ width: 10, height: 10, cellSize: 2, originX: -10, originZ: -10 });
}

describe('CollisionGrid mapping + query', () => {
  it('maps world coordinates to cells and back', () => {
    const g = grid10();
    expect(g.colOf(-10)).toBe(0); // the min corner
    expect(g.colOf(-9)).toBe(0); // first cell spans [-10,-8)
    expect(g.colOf(-8)).toBe(1);
    expect(g.colOf(9.9)).toBe(9); // last cell spans [8,10)
    expect(g.rowOf(0)).toBe(5);
  });

  it('reports blocked only inside a painted cell; outside the grid is clear', () => {
    const g = grid10();
    g.setBlocked(5, 5, true); // the cell covering world [0,2) × [0,2)
    expect(g.isBlocked(1, 1)).toBe(true);
    expect(g.isBlocked(3, 3)).toBe(false); // a neighbour cell, unpainted
    expect(g.isBlocked(999, 999)).toBe(false); // off the grid reads as clear (world-end handles the void)
  });

  it('round-trips through the serialized map form', () => {
    const g = grid10();
    g.setBlocked(2, 3, true);
    g.setBlocked(7, 8, true);
    const back = CollisionGrid.fromMap(g.toMap());
    expect(back.width).toBe(g.width);
    expect(back.cellSize).toBe(g.cellSize);
    expect(back.isBlocked(g.originX + 2 * 2 + 1, g.originZ + 3 * 2 + 1)).toBe(true);
    expect(back.isBlocked(g.originX + 7 * 2 + 1, g.originZ + 8 * 2 + 1)).toBe(true);
    expect(back.isBlocked(0, 0)).toBe(false);
  });
});

describe('gridBlockSystem', () => {
  /** Block a whole vertical strip of cells at one column (a wall running along z). */
  function wallAtColumn(g: CollisionGrid, col: number): void {
    for (let row = 0; row < g.height; row++) g.setBlocked(col, row, true);
  }

  it('pushes a mover out of a blocked cell until it no longer overlaps', () => {
    const g = grid10();
    wallAtColumn(g, 5); // blocks world x ∈ [0,2)
    const world = new World();
    const e = world.createEntity();
    world.add(e, Transform, { x: 0.5, z: 0, rotationY: 0 }); // sitting inside the wall
    world.add(e, Collider, { radius: 0.5 });

    gridBlockSystem(world, g, [e]);

    const t = world.get(e, Transform)!;
    expect(g.isBlocked(t.x, t.z)).toBe(false); // ejected out of the rock
    expect(t.x).toBeLessThan(0.5); // pushed toward the open side (−x), the nearer face
  });

  it('preserves tangential position — slide, not stick', () => {
    const g = grid10();
    wallAtColumn(g, 5); // a wall on the +x side
    const world = new World();
    const e = world.createEntity();
    // Overlapping the wall from the left: penetration is along x only; z must be untouched (slide along it).
    world.add(e, Transform, { x: -0.2, z: 3.5, rotationY: 0 });
    world.add(e, Collider, { radius: 0.8 });

    gridBlockSystem(world, g, [e]);

    const t = world.get(e, Transform)!;
    expect(t.z).toBeCloseTo(3.5, 5); // tangential (z) survives
    expect(t.x).toBeLessThanOrEqual(0); // corrected out along the contact normal (−x)
  });

  it('leaves a mover in clear space untouched', () => {
    const g = grid10();
    wallAtColumn(g, 9); // far-edge wall
    const world = new World();
    const e = world.createEntity();
    world.add(e, Transform, { x: -4, z: -4, rotationY: 0 });
    world.add(e, Collider, { radius: 0.8 });

    gridBlockSystem(world, g, [e]);

    expect(world.get(e, Transform)!).toMatchObject({ x: -4, z: -4 });
  });

  it('falls back to a default radius for a mover with no Collider (a guard)', () => {
    const g = grid10();
    wallAtColumn(g, 5);
    const world = new World();
    const e = world.createEntity();
    world.add(e, Transform, { x: 0.5, z: -2, rotationY: 0 }); // inside the wall, no Collider
    gridBlockSystem(world, g, [e]);
    expect(g.isBlocked(world.get(e, Transform)!.x, world.get(e, Transform)!.z)).toBe(false);
  });
});
