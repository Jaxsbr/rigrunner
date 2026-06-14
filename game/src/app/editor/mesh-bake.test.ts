import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CollisionGrid } from '@features/terrain/collision-grid';
import { bakeTemplateFootprint } from './mesh-bake';

/** A 2×2 box standing from y=0..2 (base-centre origin), so it clears the floor threshold and bakes. */
function standingBox(): THREE.Object3D {
  const geo = new THREE.BoxGeometry(2, 2, 2);
  geo.translate(0, 1, 0);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo));
  return group;
}

describe('bakeTemplateFootprint', () => {
  it('blocks the cells under a standing model at its placement, and nothing far from it', () => {
    const grid = CollisionGrid.blank(20, 0.5);
    bakeTemplateFootprint(standingBox(), grid, 4, -6, 0, 1);
    expect(grid.isBlocked(4, -6)).toBe(true);    // centre
    expect(grid.isBlocked(4.6, -5.4)).toBe(true); // inside the 2×2 footprint (±1 of centre)
    expect(grid.isBlocked(9, -6)).toBe(false);    // well clear
  });

  it('scales the footprint with the placement scale', () => {
    const grid = CollisionGrid.blank(20, 0.5);
    bakeTemplateFootprint(standingBox(), grid, 0, 0, 0, 2); // doubled → spans ±2
    expect(grid.isBlocked(1.8, 0)).toBe(true);  // reached only because of the 2× scale (outside ±1)
    expect(grid.isBlocked(3.5, 0)).toBe(false); // well clear of the doubled box
  });

  it('moving a placement leaves no orphan: un-stamp the old cells, stamp the new ones', () => {
    // Mirrors the store's stamp/un-stamp on the one authoritative grid: stamp records the cells it set, a
    // move clears exactly them, then stamps at the new position — so the old footprint never lingers.
    const grid = CollisionGrid.blank(20, 0.5);
    const stampAt = (x: number, z: number): Set<number> => {
      const scratch = CollisionGrid.blank(20, 0.5);
      bakeTemplateFootprint(standingBox(), scratch, x, z, 0, 1);
      const cells = new Set<number>();
      for (let i = 0; i < scratch.cells.length; i++) if (scratch.cells[i]) { grid.cells[i] = 1; cells.add(i); }
      return cells;
    };
    const unstamp = (cells: Set<number>): void => { for (const i of cells) grid.cells[i] = 0; };

    let stamped = stampAt(0, 0);
    expect(grid.isBlocked(0, 0)).toBe(true);

    unstamp(stamped); // move: clear the old footprint…
    stamped = stampAt(8, 8); // …then stamp the new one
    expect(grid.isBlocked(0, 0)).toBe(false); // the old footprint is gone — no orphan
    expect(grid.isBlocked(8, 8)).toBe(true);
  });
});
