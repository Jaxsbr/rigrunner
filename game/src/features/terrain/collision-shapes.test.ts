import { describe, it, expect } from 'vitest';
import { CollisionGrid } from './collision-grid';
import { compileCollision, sampleSpline, type CollisionShape } from './collision-shapes';

/** A 40×40-cell grid, 1 unit/cell, covering [-20,20]. */
function grid40(): CollisionGrid {
  return new CollisionGrid({ width: 40, height: 40, cellSize: 1, originX: -20, originZ: -20 });
}

describe('sampleSpline', () => {
  it('passes through its control points and densifies between them', () => {
    const pts = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }];
    const poly = sampleSpline(pts, false);
    expect(poly.length).toBeGreaterThan(pts.length); // densified
    expect(poly[0]).toEqual({ x: 0, z: 0 });          // starts on the first point
    expect(poly[poly.length - 1]).toEqual({ x: 10, z: 10 }); // ends on the last
  });
});

describe('compileCollision', () => {
  it('fills the interior of a closed shape', () => {
    const grid = grid40();
    const square: CollisionShape = {
      points: [{ x: -8, z: -8 }, { x: 8, z: -8 }, { x: 8, z: 8 }, { x: -8, z: 8 }],
      closed: true, carve: false, thickness: 0,
    };
    compileCollision(grid, null, [square]);
    expect(grid.isBlocked(0, 0)).toBe(true);    // inside
    expect(grid.isBlocked(15, 15)).toBe(false); // outside
  });

  it('strokes a thick band along an open path, leaving the sides clear', () => {
    const grid = grid40();
    const wall: CollisionShape = {
      points: [{ x: -10, z: 0 }, { x: 10, z: 0 }],
      closed: false, carve: false, thickness: 4,
    };
    compileCollision(grid, null, [wall]);
    expect(grid.isBlocked(0, 0)).toBe(true);   // on the line
    expect(grid.isBlocked(0, 1)).toBe(true);   // within the 4-wide band
    expect(grid.isBlocked(0, 8)).toBe(false);  // well off the band
  });

  it('carves cleared space out of the base layer', () => {
    const grid = grid40();
    const base = new Uint8Array(grid.width * grid.height).fill(1); // all blocked
    const hole: CollisionShape = {
      points: [{ x: -6, z: -6 }, { x: 6, z: -6 }, { x: 6, z: 6 }, { x: -6, z: 6 }],
      closed: true, carve: true, thickness: 0,
    };
    compileCollision(grid, base, [hole]);
    expect(grid.isBlocked(0, 0)).toBe(false);   // carved open
    expect(grid.isBlocked(15, 15)).toBe(true);  // base still blocked outside the hole
  });
});
