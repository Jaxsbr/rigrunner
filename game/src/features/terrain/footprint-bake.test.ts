import { describe, it, expect } from 'vitest';
import { CollisionGrid } from './collision-grid';
import { rasterizeFootprint } from './footprint-bake';

/** A 10×10-cell grid, 2 units/cell, covering [-10,10]. */
function grid10(): CollisionGrid {
  return new CollisionGrid({ width: 10, height: 10, cellSize: 2, originX: -10, originZ: -10 });
}

/** Count blocked cells. */
function blockedCount(g: CollisionGrid): number {
  let n = 0;
  for (const c of g.cells) if (c === 1) n++;
  return n;
}

describe('rasterizeFootprint', () => {
  it('marks the cells a standing triangle covers, leaving the rest clear', () => {
    const g = grid10();
    // A triangle standing above the floor, spanning roughly world [0,4] × [0,4].
    const positions = [
      0, 5, 0,
      4, 5, 0,
      0, 5, 4,
    ];
    rasterizeFootprint(g, positions, null, 0.5);
    expect(g.isBlocked(0.5, 0.5)).toBe(true); // clearly inside
    expect(g.isBlocked(-5, -5)).toBe(false); // far away
    expect(blockedCount(g)).toBeGreaterThan(0);
  });

  it('ignores triangles at or below the floor threshold (sunk feet / gaps)', () => {
    const g = grid10();
    const sunk = [
      0, -1, 0,
      4, -1, 0,
      0, -1, 4,
    ];
    rasterizeFootprint(g, sunk, null, 0.5);
    expect(blockedCount(g)).toBe(0); // nothing standing → nothing blocked
  });

  it('leaves no interior hole — a triangle bigger than a cell fills contiguously', () => {
    const g = grid10();
    // A big triangle covering most of the +x +z quadrant.
    const positions = [
      0.1, 4, 0.1,
      9, 4, 0.1,
      0.1, 4, 9,
    ];
    rasterizeFootprint(g, positions, null, 0.5);
    // Every cell whose centre is well inside the triangle must be blocked (no missed slivers).
    for (let row = 5; row < 9; row++) {
      for (let col = 5; col < 9; col++) {
        const cx = g.originX + col * g.cellSize + 1;
        const cz = g.originZ + row * g.cellSize + 1;
        if (cx + cz < 8.5) {
          // inside the x+z < 9 triangle, away from the hypotenuse
          expect(g.isBlocked(cx, cz)).toBe(true);
        }
      }
    }
  });
});
