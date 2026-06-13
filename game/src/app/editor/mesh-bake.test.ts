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

  it('moving a placement leaves no orphan: effective = base ∪ rebake clears the old cells', () => {
    const base = CollisionGrid.blank(20, 0.5); // a clear hand layer
    const effective = CollisionGrid.blank(20, 0.5);
    const rebakeAt = (x: number, z: number): void => {
      const footprint = CollisionGrid.blank(20, 0.5);
      bakeTemplateFootprint(standingBox(), footprint, x, z, 0, 1);
      for (let i = 0; i < effective.cells.length; i++) {
        effective.cells[i] = base.cells[i]! | footprint.cells[i]! ? 1 : 0;
      }
    };

    rebakeAt(0, 0);
    expect(effective.isBlocked(0, 0)).toBe(true);

    rebakeAt(8, 8); // "move" the placement
    expect(effective.isBlocked(0, 0)).toBe(false); // the old footprint is gone — no orphan
    expect(effective.isBlocked(8, 8)).toBe(true);
  });
});
