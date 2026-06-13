import { describe, it, expect } from 'vitest';
import { CollisionGrid, type CollisionMap } from '@features/terrain/collision-grid';
import { EXIT_GAPS } from './real-game';
import realGameMap from './maps/real-game.map.json';

/**
 * Pins the committed collision map to the world it must fit: the painted gaps line up with the exit
 * angles the camps guard, the ridge between them is a solid wall, and the bowl interior is clear. If the
 * mountain art changes and the map is re-baked, a drift between the gaps and the camps fails HERE — the
 * exact misalignment (camps off the real gap mouths) that this whole change set up to fix.
 */
const grid = CollisionGrid.fromMap(realGameMap as CollisionMap);
const at = (angle: number, r: number): readonly [number, number] => [Math.cos(angle) * r, Math.sin(angle) * r];

// The ridge band the gaps cut through (inner foot → outer foot, in world units).
const BAND_MIN = 78;
const BAND_MAX = 112;

describe('committed real-game collision map', () => {
  it('leaves a clear drivable corridor through the ridge at every exit gap the camps guard', () => {
    for (const g of EXIT_GAPS) {
      for (let r = BAND_MIN; r <= BAND_MAX; r += 2) {
        const [x, z] = at(g.angle, r);
        expect(grid.isBlocked(x, z)).toBe(false); // the camp's gap is genuinely open, end to end
      }
    }
  });

  it('walls the ridge between the gaps — the barrier is continuous, not all gap', () => {
    for (const a of [0.7, 1.4, 2.8, 3.4, 4.8, 5.6]) {
      let blocked = false;
      for (let r = BAND_MIN + 2; r <= BAND_MAX - 2; r += 2) {
        if (grid.isBlocked(...at(a, r))) { blocked = true; break; }
      }
      expect(blocked).toBe(true);
    }
  });

  it('keeps the bowl interior clear (spawn, workshop, the on-path pile, the shop)', () => {
    for (const [x, z] of [[0, 0], [0, 8], [12, -12], [36, -37]] as const) {
      expect(grid.isBlocked(x, z)).toBe(false);
    }
  });
});
