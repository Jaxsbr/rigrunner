import { describe, it, expect } from 'vitest';
import { BuildAffordances } from './build-affordances';

/**
 * The snap-highlight pad sizes to the carried part's deck footprint, so a multi-cell part (the 2×2
 * chassis kit) lights its WHOLE region rather than a single cell floating in the middle of it. Only
 * the pure span maths is covered here — the breathing/pop animation and THREE wiring are view polish.
 */
describe('BuildAffordances.padMeters', () => {
  it('spans a single cell inset off the grid lines (the common 1×1 part)', () => {
    expect(BuildAffordances.padMeters({ cols: 1, rows: 1 })).toEqual({ x: 0.9, z: 0.9 });
  });

  it('spans the whole 2×2 region for a chassis kit (all four cells, same inset)', () => {
    expect(BuildAffordances.padMeters({ cols: 2, rows: 2 })).toEqual({ x: 1.9, z: 1.9 });
  });

  it('scales each axis independently for a non-square footprint', () => {
    expect(BuildAffordances.padMeters({ cols: 3, rows: 1 })).toEqual({ x: 2.9, z: 0.9 });
  });
});
